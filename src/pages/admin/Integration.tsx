import { useState } from "react";
import Dashboard from "./Dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiKeyManager } from "@/components/admin/ApiKeyManager";
import { FieldConfigManager } from "@/components/admin/FieldConfigManager";
import { RequestParametersDocs } from "@/components/admin/RequestParametersDocs";
import { FlowiseConfigManager } from "@/components/admin/FlowiseConfigManager";
import { FonnteConfigManager } from "@/components/admin/FonnteConfigManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Copy, Check, Code, Key, BookOpen, ChevronDown, Settings, FileCode, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Integration = () => {
  const [copied, setCopied] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(true);
  const [docsOpen, setDocsOpen] = useState(true);
  const [samplesOpen, setSamplesOpen] = useState(false);
  const [responsesOpen, setResponsesOpen] = useState(false);
  const { toast } = useToast();

  const apiEndpoint = "https://ykaawgnggvwleiyzvilf.supabase.co/functions/v1/submit-report";
  
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast({
      title: "Copied to clipboard",
      description: `${label} has been copied to your clipboard.`,
    });
    setTimeout(() => setCopied(null), 2000);
  };

  const curlExample = `curl -X POST ${apiEndpoint} \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_SECRET_KEY" \\
  -d '{
    "reporter_name": "John Doe",
    "phone": "08123456789",
    "address": "Jl. Sudirman No. 123, Jakarta",
    "description": "Street light not working on main road",
    "type": "lapor",
    "photo_url": "https://example.com/photo.jpg",
    "geo_location": {
      "lat": -6.2088,
      "lng": 106.8456
    }
  }'`;

  const javascriptExample = `// Using fetch API
const submitReport = async (reportData) => {
  try {
    const response = await fetch('${apiEndpoint}', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'YOUR_API_SECRET_KEY'
      },
      body: JSON.stringify({
        reporter_name: reportData.name,
        phone: reportData.phone,
        address: reportData.address,
        description: reportData.description,
        type: 'lapor', // or 'aspirasi'
        photo_url: reportData.photoUrl || null,
        geo_location: reportData.location || null
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('Report submitted:', result.data.id);
      return result;
    } else {
      console.error('Error:', result.error);
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Failed to submit report:', error);
    throw error;
  }
};

// Example usage
submitReport({
  name: "Jane Smith",
  phone: "08123456789",
  address: "Jakarta Selatan",
  description: "Pothole on the road",
  photoUrl: "https://example.com/image.jpg",
  location: { lat: -6.2088, lng: 106.8456 }
});`;

  const pythonExample = `import requests
import json

def submit_report(report_data):
    """Submit a report to the API"""
    url = '${apiEndpoint}'
    headers = {
        'Content-Type': 'application/json',
        'x-api-key': 'YOUR_API_SECRET_KEY'
    }
    
    payload = {
        'reporter_name': report_data['name'],
        'phone': report_data['phone'],
        'address': report_data['address'],
        'description': report_data['description'],
        'type': 'lapor',  # or 'aspirasi'
        'photo_url': report_data.get('photo_url'),
        'geo_location': report_data.get('location')
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        result = response.json()
        print(f"Report submitted: {result['data']['id']}")
        return result
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")
        raise

# Example usage
report = {
    'name': 'John Doe',
    'phone': '08123456789',
    'address': 'Jakarta',
    'description': 'Issue description',
    'photo_url': 'https://example.com/photo.jpg',
    'location': {'lat': -6.2088, 'lng': 106.8456}
}

submit_report(report)`;

  const phpExample = `<?php
function submitReport($reportData) {
    $url = '${apiEndpoint}';
    $apiKey = 'YOUR_API_SECRET_KEY';
    
    $data = array(
        'reporter_name' => $reportData['name'],
        'phone' => $reportData['phone'],
        'address' => $reportData['address'],
        'description' => $reportData['description'],
        'type' => 'lapor', // or 'aspirasi'
        'photo_url' => $reportData['photo_url'] ?? null,
        'geo_location' => $reportData['location'] ?? null
    );
    
    $options = array(
        'http' => array(
            'header'  => "Content-Type: application/json\\r\\n" .
                        "x-api-key: $apiKey\\r\\n",
            'method'  => 'POST',
            'content' => json_encode($data)
        )
    );
    
    $context  = stream_context_create($options);
    $result = file_get_contents($url, false, $context);
    
    if ($result === FALSE) {
        throw new Exception('Failed to submit report');
    }
    
    return json_decode($result, true);
}

// Example usage
$report = array(
    'name' => 'John Doe',
    'phone' => '08123456789',
    'address' => 'Jakarta',
    'description' => 'Issue description',
    'photo_url' => 'https://example.com/photo.jpg',
    'location' => array('lat' => -6.2088, 'lng' => 106.8456)
);

try {
    $response = submitReport($report);
    echo "Report ID: " . $response['data']['id'];
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>`;

  return (
    <Dashboard>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">API Integration</h1>
          <p className="text-muted-foreground">
            Integrate report submissions from external platforms like WhatsApp, Telegram, or your own systems
          </p>
        </div>

        <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    <div className="text-left">
                      <CardTitle>API Key Management</CardTitle>
                      <CardDescription>Generate and manage API keys for secure third-party access</CardDescription>
                    </div>
                  </div>
                  <ChevronDown className={`h-5 w-5 transition-transform ${configOpen ? "rotate-180" : ""}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-6">
                <ApiKeyManager />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <Collapsible open={true}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    <div className="text-left">
                      <CardTitle>Field Configuration</CardTitle>
                      <CardDescription>Configure which fields are required or optional for API submissions</CardDescription>
                    </div>
                  </div>
                  <ChevronDown className="h-5 w-5 transition-transform" />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-6">
                <FieldConfigManager />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <Collapsible open={true}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    <div className="text-left">
                      <CardTitle>Flowise Configuration</CardTitle>
                      <CardDescription>Configure AI agent settings for WhatsApp integration</CardDescription>
                    </div>
                  </div>
                  <ChevronDown className="h-5 w-5 transition-transform" />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-6">
                <FlowiseConfigManager />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <Collapsible open={true}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    <div className="text-left">
                      <CardTitle>Fonnte Configuration</CardTitle>
                      <CardDescription>Configure WhatsApp gateway settings and webhook</CardDescription>
                    </div>
                  </div>
                  <ChevronDown className="h-5 w-5 transition-transform" />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-6">
                <FonnteConfigManager />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <Collapsible open={docsOpen} onOpenChange={setDocsOpen}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    <div className="text-left">
                      <CardTitle>API Documentation</CardTitle>
                      <CardDescription>Endpoint information and request parameters</CardDescription>
                    </div>
                  </div>
                  <ChevronDown className={`h-5 w-5 transition-transform ${docsOpen ? "rotate-180" : ""}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        API Endpoint
                      </CardTitle>
                      <CardDescription>Use this endpoint to submit reports programmatically</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Endpoint URL</Label>
                        <div className="flex gap-2">
                          <Input
                            value={apiEndpoint}
                            readOnly
                            className="font-mono text-sm"
                          />
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => copyToClipboard(apiEndpoint, "Endpoint")}
                          >
                            {copied === "Endpoint" ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Method</Label>
                        <Input value="POST" readOnly className="font-mono" />
                      </div>

                      <div className="space-y-2">
                        <Label>Authentication</Label>
                        <p className="text-sm text-muted-foreground">
                          Include your API key in the request headers as <code className="bg-muted px-1 py-0.5 rounded">x-api-key</code>
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5" />
                        Request Parameters
                      </CardTitle>
                      <CardDescription>Required and optional fields for report submission</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <RequestParametersDocs />
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <Collapsible open={samplesOpen} onOpenChange={setSamplesOpen}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode className="h-5 w-5" />
                    <div className="text-left">
                      <CardTitle>Sample Code</CardTitle>
                      <CardDescription>Integration examples in multiple programming languages</CardDescription>
                    </div>
                  </div>
                  <ChevronDown className={`h-5 w-5 transition-transform ${samplesOpen ? "rotate-180" : ""}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-6">
                <Tabs defaultValue="curl" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="curl">cURL</TabsTrigger>
                    <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                    <TabsTrigger value="python">Python</TabsTrigger>
                    <TabsTrigger value="php">PHP</TabsTrigger>
                  </TabsList>

                  <TabsContent value="curl" className="space-y-4">
                    <div className="relative">
                      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{curlExample}</code>
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(curlExample, "cURL code")}
                      >
                        {copied === "cURL code" ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="javascript" className="space-y-4">
                    <div className="relative">
                      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{javascriptExample}</code>
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(javascriptExample, "JavaScript code")}
                      >
                        {copied === "JavaScript code" ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="python" className="space-y-4">
                    <div className="relative">
                      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{pythonExample}</code>
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(pythonExample, "Python code")}
                      >
                        {copied === "Python code" ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="php" className="space-y-4">
                    <div className="relative">
                      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{phpExample}</code>
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(phpExample, "PHP code")}
                      >
                        {copied === "PHP code" ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <Collapsible open={responsesOpen} onOpenChange={setResponsesOpen}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    <div className="text-left">
                      <CardTitle>Response & Error Handling</CardTitle>
                      <CardDescription>Response formats and error troubleshooting</CardDescription>
                    </div>
                  </div>
                  <ChevronDown className={`h-5 w-5 transition-transform ${responsesOpen ? "rotate-180" : ""}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-6 space-y-6">
                <Card className="border-primary/50">
                  <CardHeader>
                    <CardTitle>Response Format</CardTitle>
                    <CardDescription>Successful response example</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                      <code>{`{
  "success": true,
  "message": "Report submitted successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "pending",
    "created_at": "2025-10-24T10:30:00.000Z"
  }
}`}</code>
                    </pre>
                  </CardContent>
                </Card>

                <Card className="border-destructive/50">
                  <CardHeader>
                    <CardTitle>Error Handling</CardTitle>
                    <CardDescription>Common error responses and troubleshooting</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="font-medium">401 Unauthorized</p>
                        <pre className="bg-muted p-2 rounded mt-1 text-xs overflow-x-auto">
                          <code>{"{ \"error\": \"Unauthorized - Invalid API key\" }"}</code>
                        </pre>
                        <p className="text-muted-foreground mt-1">Check that your API key is correct and included in the x-api-key header</p>
                      </div>

                      <div>
                        <p className="font-medium">400 Bad Request</p>
                        <pre className="bg-muted p-2 rounded mt-1 text-xs overflow-x-auto">
                          <code>{"{ \"error\": \"Missing required fields\", \"required\": [...] }"}</code>
                        </pre>
                        <p className="text-muted-foreground mt-1">Ensure all required fields are included in your request</p>
                      </div>

                      <div>
                        <p className="font-medium">500 Internal Server Error</p>
                        <pre className="bg-muted p-2 rounded mt-1 text-xs overflow-x-auto">
                          <code>{"{ \"error\": \"Internal server error\", \"message\": \"...\" }"}</code>
                        </pre>
                        <p className="text-muted-foreground mt-1">Contact support if this persists</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </Dashboard>
  );
};

export default Integration;
