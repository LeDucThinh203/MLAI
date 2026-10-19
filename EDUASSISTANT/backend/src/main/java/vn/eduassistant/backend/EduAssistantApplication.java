package vn.eduassistant.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.List;

@SpringBootApplication
public class EduAssistantApplication {
    public static void main(String[] args) {
        loadDotEnv();
        SpringApplication.run(EduAssistantApplication.class, args);
    }
    private static void loadDotEnv(){
        Path cwd=Paths.get(System.getProperty("user.dir",".")).toAbsolutePath().normalize();
        List<Path> candidates=Arrays.asList(cwd.resolve(".env"),cwd.resolve("backend/.env"),cwd.resolve("../.env"),cwd.resolve("../../.env"),cwd.resolve("EDUASSISTANT/.env"));
        for(Path path:candidates){if(!Files.isRegularFile(path))continue;try{for(String line:Files.readAllLines(path,StandardCharsets.UTF_8)){String raw=line.trim();if(raw.isEmpty()||raw.startsWith("#"))continue;if(raw.startsWith("export "))raw=raw.substring(7).trim();int equals=raw.indexOf('=');if(equals<1)continue;String key=raw.substring(0,equals).trim(),value=raw.substring(equals+1).trim();if(value.length()>=2&&((value.startsWith("\"")&&value.endsWith("\""))||(value.startsWith("'")&&value.endsWith("'"))))value=value.substring(1,value.length()-1);if(System.getenv(key)==null&&System.getProperty(key)==null)System.setProperty(key,value);}}catch(Exception ignored){}}
    }
}
