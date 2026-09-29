@echo off
rem Naru 실행 스크립트 (더블클릭으로 실행)
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [!] Node.js가 없습니다. https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요.
    pause
    exit /b 1
)

if not exist node_modules (
    echo [1/3] 패키지 설치 중...
    call npm install
)

if not exist .env (
    copy .env.example .env >nul
    echo [!] .env 파일을 만들었습니다. DB 주소를 확인한 뒤 다시 실행하세요.
    notepad .env
    exit /b 0
)

echo [2/3] 캐릭터 정보를 DB에 반영 중...
call npm run sync
if errorlevel 1 (
    echo [!] DB 연결에 실패했습니다. MongoDB가 켜져 있는지, .env 의 MONGODB_URI 가 맞는지 확인하세요.
    pause
    exit /b 1
)

echo [3/3] 서버 시작. 브라우저가 열립니다. 끄려면 이 창을 닫으세요.
start "" cmd /c "timeout /t 3 >nul & start http://localhost:3000"
call npm start
pause
