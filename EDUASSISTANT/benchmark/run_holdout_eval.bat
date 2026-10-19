@echo off
setlocal
cd /d "%~dp0.."
call mvnw.cmd -f backend\pom.xml -DskipTests spring-boot:run "-Dspring-boot.run.arguments=--spring.main.web-application-type=none,--eduassistant.evaluation=holdout"
exit /b %errorlevel%
