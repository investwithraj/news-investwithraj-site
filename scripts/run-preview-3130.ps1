$projectRoot = Split-Path -Parent $PSScriptRoot
$nodePath = (Get-Command node.exe).Source
$nextPath = Join-Path $projectRoot "node_modules\next\dist\bin\next"

Set-Location -LiteralPath $projectRoot
& $nodePath $nextPath start -p 3130
