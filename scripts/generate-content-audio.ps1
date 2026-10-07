param(
  [string]$ScriptPath = 'docs/content/scripts/audio-v1.json',
  [string]$OutputDirectory = 'public/content/v1/audio',
  [switch]$SkipExisting
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$fishAudioRoot = [IO.Path]::GetFullPath((Get-Location).Path)
$fishAudioOutput = [IO.Path]::GetFullPath((Join-Path $fishAudioRoot $OutputDirectory))
if (-not $fishAudioOutput.StartsWith($fishAudioRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Output must remain in this workspace.' }
New-Item -ItemType Directory -Path $fishAudioOutput -Force | Out-Null
$fishVoiceData = Get-Content -LiteralPath $ScriptPath -Raw -Encoding UTF8 | ConvertFrom-Json
$fishSynth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $fishSynth.SelectVoice('Microsoft Huihui Desktop')
  $fishSynth.Rate = -1
  $fishSynth.Volume = 90
  $fishAudioCreated = 0
  foreach ($fishClip in $fishVoiceData.records) {
    if ($fishClip.id -notmatch '^VO-[A-Z-]+$') { throw 'Invalid audio ID.' }
    $fishClipPath = Join-Path $fishAudioOutput ($fishClip.id.ToLowerInvariant() + '.wav')
    if ($SkipExisting -and (Test-Path -LiteralPath $fishClipPath)) { continue }
    $fishSynth.SetOutputToWaveFile($fishClipPath, (New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(24000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)))
    $fishSynth.Speak([string]$fishClip.text)
    $fishSynth.SetOutputToNull()
    $fishAudioCreated++
  }
  Write-Output ('Generated ' + $fishAudioCreated + ' WAV clips with Microsoft Huihui Desktop.')
} finally { $fishSynth.Dispose() }
