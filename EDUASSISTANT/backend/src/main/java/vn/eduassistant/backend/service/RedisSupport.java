package vn.eduassistant.backend.service;

import io.lettuce.core.RedisClient;
import io.lettuce.core.RedisURI;
import io.lettuce.core.ScriptOutputType;
import io.lettuce.core.SocketOptions;
import io.lettuce.core.ClientOptions;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.sync.RedisCommands;
import io.lettuce.core.SetArgs;
import org.springframework.stereotype.Component;
import vn.eduassistant.backend.config.AppConfig;
import vn.eduassistant.backend.core.Json;
import javax.annotation.PreDestroy;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.*;

/** Optional Redis state; all methods fail closed to the existing in-process/DB behavior. */
@Component
public class RedisSupport {
    private final AppConfig config;
    private volatile RedisClient client;
    private volatile StatefulRedisConnection<String,String> connection;
    private volatile long retryAfter;
    public RedisSupport(AppConfig config){this.config=config;}

    public boolean connected(){RedisCommands<String,String> c=commands();if(c==null)return false;try{return "PONG".equalsIgnoreCase(c.ping());}catch(Exception e){failed();return false;}}
    public Long loginLockSeconds(String username){RedisCommands<String,String>c=commands();if(c==null)return null;try{Long ttl=c.ttl(loginKeys(username)[1]);return ttl==null||ttl<1?0L:ttl;}catch(Exception e){failed();return null;}}
    public boolean recordLoginFailure(String username){RedisCommands<String,String>c=commands();if(c==null)return false;try{String[]k=loginKeys(username);c.eval("local count=redis.call('INCR',KEYS[1]); if count==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; if count>=tonumber(ARGV[2]) then redis.call('SET',KEYS[2],'1','EX',ARGV[3]); redis.call('DEL',KEYS[1]) end; return count",ScriptOutputType.INTEGER,new String[]{k[0],k[1]},"300","5","300");return true;}catch(Exception e){failed();return false;}}
    public void clearLoginFailures(String username){RedisCommands<String,String>c=commands();if(c==null)return;try{c.del(loginKeys(username));}catch(Exception e){failed();}}
    public Object getJson(String namespace,Object identity){RedisCommands<String,String>c=commands();if(c==null)return null;try{String version=c.get(versionKey(namespace));if(version==null)version="0";String raw=c.get(cacheKey(namespace,identity,version));return raw==null?null:Json.parse(raw);}catch(Exception e){failed();return null;}}
    public void setJson(String namespace,Object identity,Object value,int ttlSeconds){RedisCommands<String,String>c=commands();if(c==null)return;try{String version=c.get(versionKey(namespace));if(version==null)version="0";c.set(cacheKey(namespace,identity,version),Json.stringify(value),SetArgs.Builder.ex(Math.max(1,ttlSeconds)));}catch(Exception e){failed();}}
    public void bumpCacheVersion(String namespace){RedisCommands<String,String>c=commands();if(c==null)return;try{c.incr(versionKey(namespace));}catch(Exception e){failed();}}
    @PreDestroy public synchronized void close(){if(connection!=null){try{connection.close();}catch(Exception ignored){}connection=null;}if(client!=null){try{client.shutdown();}catch(Exception ignored){}client=null;}}

    private RedisCommands<String,String> commands(){if(config.redisUrl==null||config.redisUrl.trim().isEmpty()||System.currentTimeMillis()<retryAfter)return null;StatefulRedisConnection<String,String> ready=connection;if(ready!=null&&ready.isOpen())return ready.sync();synchronized(this){if(connection!=null&&connection.isOpen())return connection.sync();RedisClient candidate=null;StatefulRedisConnection<String,String> opened=null;try{RedisURI uri=RedisURI.create(config.redisUrl.trim());candidate=RedisClient.create(uri);candidate.setOptions(ClientOptions.builder().socketOptions(SocketOptions.builder().connectTimeout(Duration.ofSeconds(1)).build()).build());opened=candidate.connect();opened.setTimeout(Duration.ofSeconds(1));opened.sync().ping();client=candidate;connection=opened;return opened.sync();}catch(Exception e){if(opened!=null)try{opened.close();}catch(Exception ignored){}if(candidate!=null)try{candidate.shutdown();}catch(Exception ignored){}retryAfter=System.currentTimeMillis()+30000L;return null;}}}
    private synchronized void failed(){retryAfter=System.currentTimeMillis()+30000L;if(connection!=null){try{connection.close();}catch(Exception ignored){}connection=null;}if(client!=null){try{client.shutdown();}catch(Exception ignored){}client=null;}}
    private String[] loginKeys(String username){String digest=sha256((username==null?"":username).getBytes(java.nio.charset.StandardCharsets.UTF_8));String prefix=prefix();return new String[]{prefix+":auth:attempts:"+digest,prefix+":auth:lock:"+digest};}
    private String versionKey(String namespace){return prefix()+":cache-version:"+namespace;}
    private String cacheKey(String namespace,Object identity,String version){return prefix()+":cache:"+namespace+":v"+version+":"+sha256(Json.stringify(sorted(identity)).getBytes(java.nio.charset.StandardCharsets.UTF_8));}
    private String prefix(){return config.redisPrefix==null||config.redisPrefix.trim().isEmpty()?"eduassistant":config.redisPrefix.trim();}
    private static Object sorted(Object value){if(value instanceof Map){Map<String,Object> out=new TreeMap<String,Object>();for(Map.Entry<?,?>e:((Map<?,?>)value).entrySet())out.put(String.valueOf(e.getKey()),sorted(e.getValue()));return out;}if(value instanceof List){List<Object>out=new ArrayList<Object>();for(Object v:(List<?>)value)out.add(sorted(v));return out;}return value;}
    private static String sha256(byte[] bytes){try{byte[]hash=MessageDigest.getInstance("SHA-256").digest(bytes);StringBuilder out=new StringBuilder();for(byte b:hash)out.append(String.format("%02x",b));return out.toString();}catch(Exception e){throw new IllegalStateException(e);}}
}
