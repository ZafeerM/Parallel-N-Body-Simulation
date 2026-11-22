@echo off
REM Builds the N-Body engine with OpenMP.
cd /d "%~dp0"

REM PDC: compiler optimizations (-O2) + OpenMP (-fopenmp)
gcc -O2 -fopenmp nbody.c main.c -o nbody.exe -lm 2>nul
if %errorlevel%==0 goto ok

REM Fallback for old MinGW (mingw.org gcc 6.3) that has no libpthread.a:
REM link straight against the pthread DLL that ships with it.
echo Standard build failed, trying MinGW fallback...
for %%I in (gcc.exe) do set GCCBIN=%%~dp$PATH:I
gcc -O2 -fopenmp -c nbody.c -o nbody.o || goto fail
gcc -O2 -fopenmp -c main.c -o main.o || goto fail
gcc nbody.o main.o -o nbody.exe "%GCCBIN%..\lib\gcc\mingw32\6.3.0\libgomp.dll.a" "%GCCBIN%pthreadGC-3.dll" -lm || goto fail
del nbody.o main.o

:ok
echo Built nbody.exe
exit /b 0

:fail
echo Build failed. Make sure gcc with OpenMP support is installed.
exit /b 1
