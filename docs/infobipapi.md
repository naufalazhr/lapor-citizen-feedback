## Auth
API key header:

    curl -L -g -X GET 'https://{baseUrl}/sms/2/text/advanced' /
    -H 'Authorization: App 003026abc133714df1834b8638bb496e-8f4b3d9a-e931-478d-a994-28a725159ab9'

Basic:

    curl -L -g -X GET 'https://{baseUrl}/sms/2/text/advanced' /
    -H 'Authorization: Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ=='

API key header

    curl -L -g -X GET 'https://{baseUrl}/sms/2/text/advanced' /
    -H 'Authorization: App 003026abc133714df1834b8638bb496e-8f4b3d9a-e931-478d-a994-28a725159ab9'

## Outbound messages
# Send WhatsApp text message endpoint
POST: https://6zge2d.api.infobip.com/whatsapp/1/message/text

# Request Samples 
# POST Send Whatsapp text message | Text message
{
  "from": "441134960000",
  "to": "441134960001",
  "messageId": "a28dd97c-1ffb-4fcf-99f1-0b557ed381da",
  "content": {
    "text": "Some text"
  },
  "callbackData": "Callback data",
  "notifyUrl": "https://www.example.com/whatsapp",
  "urlOptions": {
    "shortenUrl": true,
    "trackClicks": true,
    "trackingUrl": "https://example.com/click-report",
    "removeProtocol": true
  }
}

# POST Send Whatsapp text message | with previewable url
{
  "from": "441134960000",
  "to": "441134960001",
  "messageId": "a28dd97c-1ffb-4fcf-99f1-0b557ed381da",
  "content": {
    "text": "Some text with url: http://example.com",
    "previewUrl": true
  },
  "callbackData": "Callback data",
  "notifyUrl": "https://www.example.com/whatsapp",
  "urlOptions": {
    "shortenUrl": true,
    "trackClicks": true,
    "trackingUrl": "https://example.com/click-report",
    "removeProtocol": false
  }
}

## Inbound messages
# Receive WhatsApp inbound message endpoint
POST: https://6zge2d.api.infobip.com/your/webhook/path

# Request Sample
# POST Received WhatsApp TEXT message
{
  "results": [
    {
      "from": "385919998888",
      "to": "41793026731",
      "integrationType": "WHATSAPP",
      "receivedAt": "2025-01-01T10:10:00.000+0000",
      "messageId": "wamid.HBgLMjc4MTMzMjE0ODIVAgAonoIAUsydhfskYyRDdEMjE4Njg3MzlBMDU2NzI4NgA=",
      "callbackData": "callbackData",
      "message": {
        "text": "Hello, World!",
        "type": "TEXT"
      },
      "price": {
        "pricePerMessage": 0,
        "currency": "EUR"
      },
      "contact": {
        "name": "Frank"
      }
    }
  ],
  "messageCount": 1,
  "pendingMessageCount": 0
}

# POST Received WhatsApp LOCATION message
{
  "results": [
    {
      "from": "385919998888",
      "to": "41793026731",
      "integrationType": "WHATSAPP",
      "receivedAt": "2025-01-01T10:10:00.000+0000",
      "messageId": "wamid.HBgLMjc4MTMzMjE0ODIVAgAonoIAUsydhfskYyRDdEMjE4Njg3MzlBMDU2NzI4NgA=",
      "callbackData": "callbackData",
      "message": {
        "latitude": 40.748433333333,
        "longitude": -73.985655555556,
        "address": "350 5th Ave, New York, NY",
        "name": "Empire State Building",
        "url": "https://www.facebook.com/113272675352744",
        "type": "LOCATION"
      },
      "price": {
        "pricePerMessage": 0,
        "currency": "EUR"
      },
      "contact": {
        "name": "Frank"
      }
    }
  ],
  "messageCount": 1,
  "pendingMessageCount": 0
}

# POST Received WhatsApp IMAGE message
{
  "results": [
    {
      "from": "385919998888",
      "to": "41793026731",
      "integrationType": "WHATSAPP",
      "receivedAt": "2025-01-01T10:10:00.000+0000",
      "messageId": "wamid.HBgLMjc4MTMzMjE0ODIVAgAonoIAUsydhfskYyRDdEMjE4Njg3MzlBMDU2NzI4NgA=",
      "callbackData": "callbackData",
      "message": {
        "url": "https://{base_url}/whatsapp/1/senders/447796344125/media/f1b96d31-9ab9-4513-808b-50ab37360fbe",
        "caption": "Image Caption",
        "type": "IMAGE"
      },
      "price": {
        "pricePerMessage": 0,
        "currency": "EUR"
      },
      "contact": {
        "name": "Frank"
      }
    }
  ],
  "messageCount": 1,
  "pendingMessageCount": 0
}

## Download inbound media
# Download inbound media endpoint
GET: https://6zge2d.api.infobip.com/whatsapp/1/senders/{sender}/media/{mediaId}

# Request Sample
# GET DOWNLOAD INBOUND MEDIA
curl -L -g 'https://6zge2d.api.infobip.com/whatsapp/1/senders/{sender}/media/20250_13_123e4567-e89b-12d3-a456-426655440000' \
-H 'Authorization: {authorization}' \
-H 'Accept: application/json'

# GET MEDIA METADATA
GET: https://6zge2d.api.infobip.com/whatsapp/1/senders/{sender}/media/{mediaId}