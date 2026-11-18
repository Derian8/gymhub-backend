$ErrorActionPreference = 'Stop'
$raiz = $PSScriptRoot
$compose = @(
    'compose', '-f', (Join-Path $raiz 'docker-compose.yml'),
    '-f', (Join-Path $raiz 'docker-compose.watch.yml'),
    '--project-name', 'proyectoappgym'
)

function Ejecutar-Docker {
    param([string[]]$Argumentos)

    & docker @Argumentos
    if ($LASTEXITCODE -ne 0) {
        throw "Docker fallo: $($Argumentos -join ' ')"
    }
}

function Obtener-Estado {
    $estado = @{}
    $directorios = @(
        (Join-Path $raiz 'frontend/src'),
        (Join-Path $raiz 'frontend/public')
    )
    $omitidos = @('.pytest_cache', '.vercel', '__pycache__', 'media', 'staticfiles', 'tests', 'venv', '.venv')
    $carpetasBackend = Get-ChildItem -LiteralPath (Join-Path $raiz 'gymhub') -Directory -Force |
        Where-Object { $_.Name -notin $omitidos }
    $directorios += @($carpetasBackend | ForEach-Object { $_.FullName })

    $archivos = foreach ($directorio in $directorios) {
        if (Test-Path -LiteralPath $directorio) {
            Get-ChildItem -LiteralPath $directorio -Recurse -File -Force -ErrorAction SilentlyContinue
        }
    }
    $archivos += foreach ($nombre in @(
        'frontend/index.html', 'frontend/vite.config.ts', 'frontend/tailwind.config.js',
        'frontend/postcss.config.js', 'frontend/package.json', 'frontend/package-lock.json',
        'frontend/Dockerfile', 'gymhub/manage.py', 'gymhub/requirements-prod.txt',
        'gymhub/Dockerfile'
    )) {
        $ruta = Join-Path $raiz $nombre
        if (Test-Path -LiteralPath $ruta) {
            Get-Item -LiteralPath $ruta
        }
    }

    foreach ($archivo in $archivos) {
        $relativo = $archivo.FullName.Substring($raiz.Length + 1).Replace('\', '/')
        if ($relativo -match '(^|/)(__pycache__|\.pytest_cache|\.venv|venv|media|staticfiles)(/|$)' -or
            $relativo -match '\.(pyc|log)$') {
            continue
        }
        $estado[$relativo] = @{
            Ruta = $archivo.FullName
            Firma = "$($archivo.Length):$($archivo.LastWriteTimeUtc.Ticks)"
        }
    }
    return $estado
}

function Ruta-Contenedor {
    param([string]$Relativo)

    if ($Relativo.StartsWith('frontend/')) {
        return '/app/' + $Relativo.Substring('frontend/'.Length)
    }
    if ($Relativo.StartsWith('gymhub/')) {
        return '/app/' + $Relativo.Substring('gymhub/'.Length)
    }
    throw "Ruta fuera de los servicios: $Relativo"
}

function Sincronizar-Archivo {
    param([string]$Relativo, [hashtable]$Info)

    $contenedor = if ($Relativo.StartsWith('frontend/')) { 'gym-frontend' } else { 'gym-backend' }
    $destino = Ruta-Contenedor $Relativo
    $padre = $destino.Substring(0, $destino.LastIndexOf('/'))
    Ejecutar-Docker @('exec', $contenedor, 'mkdir', '-p', '--', $padre)
    Ejecutar-Docker @('cp', $Info.Ruta, ($contenedor + ':' + $destino))
    Write-Host "Actualizado: $Relativo"
}

function Eliminar-Archivo {
    param([string]$Relativo)

    $contenedor = if ($Relativo.StartsWith('frontend/')) { 'gym-frontend' } else { 'gym-backend' }
    $destino = Ruta-Contenedor $Relativo
    Ejecutar-Docker @('exec', $contenedor, 'rm', '-f', '--', $destino)
    Write-Host "Eliminado: $Relativo"
}

if (-not (Test-Path -LiteralPath (Join-Path $raiz '.env'))) {
    throw "Falta el archivo .env en $raiz."
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker no esta disponible en PATH. Inicia Docker Desktop y vuelve a intentarlo.'
}

Push-Location -LiteralPath $raiz
try {
    Ejecutar-Docker ($compose + @('up', '-d', '--build', '--no-deps', 'backend', 'frontend'))
    $anterior = Obtener-Estado
    Write-Host 'PULSO disponible en http://localhost:3000/routines'
    Write-Host 'Observando cambios cada segundo. Ctrl+C detiene la observacion.'

    while ($true) {
        Start-Sleep -Milliseconds 1000
        $actual = Obtener-Estado
        $cambiados = @($actual.Keys | Where-Object {
            -not $anterior.ContainsKey($_) -or $actual[$_].Firma -ne $anterior[$_].Firma
        })
        $eliminados = @($anterior.Keys | Where-Object { -not $actual.ContainsKey($_) })
        if ($cambiados.Count -eq 0 -and $eliminados.Count -eq 0) {
            continue
        }

        Start-Sleep -Milliseconds 400
        $actual = Obtener-Estado
        $cambiados = @($actual.Keys | Where-Object {
            -not $anterior.ContainsKey($_) -or $actual[$_].Firma -ne $anterior[$_].Firma
        })
        $eliminados = @($anterior.Keys | Where-Object { -not $actual.ContainsKey($_) })
        $afectados = @($cambiados) + @($eliminados)

        try {
            $reconstruirBackend = @($afectados | Where-Object {
                $_ -in @('gymhub/requirements-prod.txt', 'gymhub/Dockerfile')
            }).Count -gt 0
            $reconstruirFrontend = @($afectados | Where-Object {
                $_ -in @('frontend/package.json', 'frontend/package-lock.json', 'frontend/Dockerfile')
            }).Count -gt 0

            foreach ($servicio in @('backend', 'frontend')) {
                $prefijo = if ($servicio -eq 'backend') { 'gymhub/' } else { 'frontend/' }
                $cambiosServicio = @($afectados | Where-Object { $_.StartsWith($prefijo) })
                if ($cambiosServicio.Count -eq 0) {
                    continue
                }
                $reconstruir = if ($servicio -eq 'backend') { $reconstruirBackend } else { $reconstruirFrontend }
                if ($reconstruir) {
                    Write-Host "Reconstruyendo $servicio..."
                    Ejecutar-Docker ($compose + @('up', '-d', '--build', '--no-deps', $servicio))
                    continue
                }

                foreach ($relativo in $cambiados | Where-Object { $_.StartsWith($prefijo) }) {
                    Sincronizar-Archivo $relativo $actual[$relativo]
                }
                foreach ($relativo in $eliminados | Where-Object { $_.StartsWith($prefijo) }) {
                    Eliminar-Archivo $relativo
                }

                $reiniciar = $servicio -eq 'backend' -or @($cambiosServicio | Where-Object {
                    $_ -in @('frontend/vite.config.ts', 'frontend/tailwind.config.js', 'frontend/postcss.config.js')
                }).Count -gt 0
                if ($reiniciar) {
                    Ejecutar-Docker ($compose + @('restart', $servicio))
                }
            }
            $anterior = $actual
        }
        catch {
            Write-Warning "No se pudo aplicar el cambio; se reintentara: $_"
            Start-Sleep -Seconds 2
        }
    }
}
finally {
    Pop-Location
}
