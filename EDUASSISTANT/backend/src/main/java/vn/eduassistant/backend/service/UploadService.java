package vn.eduassistant.backend.service;

import org.springframework.stereotype.Service;
import vn.eduassistant.backend.config.AppConfig;
import vn.eduassistant.backend.core.Json;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.SecureRandom;
import java.util.*;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;

/** Validates file signatures before saving, then stores images as optimized WebP. */
@Service
public class UploadService {
    public static final long MAX_SIZE = 10L * 1024L * 1024L;
    private final Path directory;
    private final AuditService audits;
    private final SecureRandom random = new SecureRandom();

    public UploadService(AppConfig config, AuditService audits) {
        this.audits = audits;
        String dataDir = AppConfig.value("DATA_DIR", "");
        Path root = Paths.get(config.projectRoot).toAbsolutePath().normalize();
        this.directory = (dataDir == null || dataDir.trim().isEmpty() ? root.resolve("uploads") : Paths.get(dataDir).resolve("uploads"))
                .toAbsolutePath().normalize();
        try { Files.createDirectories(directory); } catch (IOException e) { throw new IllegalStateException("Cannot create upload directory.", e); }
    }

    public Path directory() { return directory; }

    public Map<String,Object> saveEvidence(byte[] bytes, String originalName, Map<String,Object> actor) throws IOException {
        if (bytes == null || bytes.length > MAX_SIZE) throw new IllegalArgumentException("Tệp vượt quá giới hạn 10 MB.");
        Map<String,Object> signature = validate(bytes);
        if (!Json.bool(signature.get("valid"))) throw new IllegalArgumentException(Json.str(signature.get("error")));
        boolean image = Json.bool(signature.get("isImage"));
        String filename = (image ? "evidence-" : "doc-") + randomHex(16) + (image ? ".webp" : ".pdf");
        Map<String,Object> metadata = UserService.map("originalName", originalName, "originalSize", bytes.length,
                "compressedSize", bytes.length, "mimeType", signature.get("detectedType"), "isOptimized", false, "dimensions", null);
        if (image) {
            BufferedImage input = ImageIO.read(new ByteArrayInputStream(bytes));
            if (input == null) throw new IllegalArgumentException("Ảnh bị hỏng hoặc không đúng định dạng.");
            BufferedImage scaled = scaleWithin(input, 1600, 1600);
            byte[] encoded = encodeWebp(scaled, .82f);
            Files.write(directory.resolve(filename), encoded, StandardOpenOption.CREATE_NEW);
            metadata.put("compressedSize", encoded.length); metadata.put("mimeType", "image/webp"); metadata.put("isOptimized", true);
            metadata.put("dimensions", UserService.map("width", scaled.getWidth(), "height", scaled.getHeight()));
            long savings = Math.round((1d - ((double) encoded.length / bytes.length)) * 100d);
            metadata.put("savings", savings + "%");
        } else {
            Files.write(directory.resolve(filename), bytes, StandardOpenOption.CREATE_NEW);
        }
        Map<String,Object> result = UserService.map("fileName", filename, "fileUrl", "/api/evidence/" + filename, "metadata", metadata);
        audits.log("EVIDENCE_UPLOADED", actor, UserService.map("originalName", originalName, "originalSize", bytes.length), "SUCCESS",
                "Tải lên minh chứng " + originalName + " thành công (Magic bytes: " + signature.get("detectedType") + ")");
        return result;
    }

    public Map<String,Object> saveAvatar(byte[] bytes, String originalName, Map<String,Object> actor) throws IOException {
        Map<String,Object> signature = validate(bytes);
        if (!Json.bool(signature.get("valid")) || !Json.bool(signature.get("isImage"))) throw new IllegalArgumentException("Ảnh đại diện không hợp lệ.");
        BufferedImage input = ImageIO.read(new ByteArrayInputStream(bytes));
        if (input == null) throw new IllegalArgumentException("Ảnh đại diện không hợp lệ.");
        int size = Math.min(input.getWidth(), input.getHeight());
        int x = (input.getWidth() - size) / 2, y = (input.getHeight() - size) / 2;
        BufferedImage square = input.getSubimage(x, y, size, size);
        BufferedImage output = new BufferedImage(300, 300, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = output.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.drawImage(square, 0, 0, 300, 300, null); g.dispose();
        byte[] encoded = encodeWebp(output, .85f);
        String filename = "avatar-" + randomHex(16) + ".webp";
        Files.write(directory.resolve(filename), encoded, StandardOpenOption.CREATE_NEW);
        audits.log("AVATAR_UPLOADED", actor, UserService.map("originalName", originalName, "originalSize", bytes.length, "compressedSize", encoded.length), "SUCCESS",
                "Tải lên và tối ưu hóa ảnh đại diện (" + originalName + ") thành công");
        return UserService.map("fileName", filename, "fileUrl", "/api/avatar/" + filename);
    }

    public static Map<String,Object> validate(byte[] bytes) {
        if (bytes == null || bytes.length < 8) return UserService.map("valid", false, "detectedType", null, "error", "Tệp rỗng hoặc kích thước quá nhỏ.");
        if (starts(bytes, new byte[]{(byte)0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a})) return UserService.map("valid", true, "detectedType", "image/png", "isImage", true);
        if (bytes.length >= 3 && (bytes[0]&255)==255 && (bytes[1]&255)==216 && (bytes[2]&255)==255) return UserService.map("valid", true, "detectedType", "image/jpeg", "isImage", true);
        if (bytes.length >= 12 && ascii(bytes,0,4).equals("RIFF") && ascii(bytes,8,4).equals("WEBP")) return UserService.map("valid", true, "detectedType", "image/webp", "isImage", true);
        if (bytes.length >= 5 && ascii(bytes,0,5).equals("%PDF-")) {
            String tail = new String(bytes, Math.max(0,bytes.length-1024), Math.min(1024,bytes.length), StandardCharsets.ISO_8859_1);
            if (!tail.contains("%%EOF")) return UserService.map("valid",false,"detectedType","application/pdf","error","Tệp PDF bị hỏng hoặc thiếu thẻ kết thúc %%EOF.");
            String content = new String(bytes, StandardCharsets.ISO_8859_1);
            if (content.contains("/JavaScript") || content.contains("/Launch") || content.toLowerCase(Locale.ROOT).contains("<script"))
                return UserService.map("valid",false,"detectedType","application/pdf","error","Tệp PDF chứa mã lệnh không an toàn (/JavaScript hoặc /Launch).");
            return UserService.map("valid",true,"detectedType","application/pdf","isImage",false);
        }
        return UserService.map("valid",false,"detectedType",null,"error","Chữ ký nhị phân không khớp với định dạng tài liệu được hỗ trợ.");
    }

    private byte[] encodeWebp(BufferedImage image, float quality) throws IOException {
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByMIMEType("image/webp");
        if (!writers.hasNext()) throw new IOException("WebP image encoder is unavailable.");
        ImageWriter writer = writers.next(); ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ImageOutputStream stream = ImageIO.createImageOutputStream(out)) {
            writer.setOutput(stream);
            if (writer.getDefaultWriteParam().canWriteCompressed()) {
                javax.imageio.ImageWriteParam param = writer.getDefaultWriteParam(); param.setCompressionMode(javax.imageio.ImageWriteParam.MODE_EXPLICIT); param.setCompressionQuality(quality);
                writer.write(null, new javax.imageio.IIOImage(image, null, null), param);
            } else writer.write(image);
        } finally { writer.dispose(); }
        return out.toByteArray();
    }
    private static BufferedImage scaleWithin(BufferedImage src, int maxW, int maxH) {
        double scale = Math.min(1d, Math.min((double)maxW/src.getWidth(), (double)maxH/src.getHeight()));
        int w=Math.max(1,(int)Math.round(src.getWidth()*scale)), h=Math.max(1,(int)Math.round(src.getHeight()*scale));
        BufferedImage dst=new BufferedImage(w,h,BufferedImage.TYPE_INT_RGB); Graphics2D g=dst.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION,RenderingHints.VALUE_INTERPOLATION_BICUBIC);g.drawImage(src,0,0,w,h,null);g.dispose();return dst;
    }
    private String randomHex(int bytes) { byte[] b=new byte[bytes];random.nextBytes(b);StringBuilder s=new StringBuilder();for(byte x:b)s.append(String.format("%02x",x));return s.toString(); }
    private static boolean starts(byte[] b,byte[] prefix){if(b.length<prefix.length)return false;for(int i=0;i<prefix.length;i++)if(b[i]!=prefix[i])return false;return true;}
    private static String ascii(byte[] b,int offset,int length){return new String(b,offset,length,StandardCharsets.US_ASCII);}
}
