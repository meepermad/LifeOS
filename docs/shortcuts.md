# Apple Shortcuts setup

LifeOS exposes a private HTTPS API for Apple Shortcuts. You must create these shortcuts manually on your iPhone or Mac.

## Prerequisites

1. Register a shortcut device in **Settings → Siri and Shortcuts**
2. Copy the one-time token immediately
3. Copy the API URL shown in Settings

## Shortcut: LifeOS

1. **Ask for Input**
   - Prompt: `What should I tell LifeOS?`
   - Input type: Text

2. **URL**
   - Use your production API URL, for example:
     `https://your-domain.vercel.app/api/shortcuts/command`

3. **Get Contents of URL**
   - Method: POST
   - Headers:
     - `Authorization`: `Bearer <one-time shortcut token>`
     - `Content-Type`: `application/json`
   - Request body: JSON
   - Fields:
     - `command`: Ask for Input result
     - `timezone`: `America/Chicago`
     - `clientRequestId`: a generated UUID or other unique value

4. Get Dictionary from the response

5. Get `spokenText` from the dictionary

6. **Speak Text** or **Show Result** using `spokenText`

7. If `openUrl` is present, ask whether to open LifeOS for review

## Shortcut: LifeOS Agenda

Same as **LifeOS**, but set `command` to:

```text
What is on my agenda today?
```

Do not prompt for free-form text in this shortcut.

## Security notes

- Anyone with your shortcut token can send commands to your LifeOS account
- Do not share the shortcut or token
- Revoke and rotate tokens from Settings if a device is lost
- Write commands create reviewable actions in LifeOS; they do not execute immediately

## Example PowerShell test

```powershell
$body = @{
  command = "How many hours do I work this week?"
  timezone = "America/Chicago"
  clientRequestId = [guid]::NewGuid().ToString()
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "https://your-domain.vercel.app/api/shortcuts/command" `
  -Headers @{ Authorization = "Bearer los_your_token_here" } `
  -ContentType "application/json" `
  -Body $body
```
