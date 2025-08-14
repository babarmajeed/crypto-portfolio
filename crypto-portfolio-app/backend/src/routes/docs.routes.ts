import { Router } from 'express';
import { ApiDocumentationGenerator } from '@/docs/apiDocumentation';
import { swaggerSpec } from '@/docs/swagger.config';
import { mockApiServer } from '@/mocks/mockApiServer';
import { logger } from '@/utils/logger';

const router = Router();

/**
 * Enhanced Documentation Routes
 * Provides comprehensive API documentation, testing tools, and developer resources
 */

// Initialize documentation generator
const docGenerator = new ApiDocumentationGenerator(router as any);

/**
 * @swagger
 * /docs:
 *   get:
 *     summary: API Documentation Home
 *     description: Main API documentation page with enhanced UI
 *     tags: [Documentation]
 *     responses:
 *       200:
 *         description: Documentation page served successfully
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 */
router.get('/docs', (req, res) => {
  res.redirect('/api/v1/docs/custom');
});

/**
 * @swagger
 * /docs/openapi.json:
 *   get:
 *     summary: OpenAPI Specification
 *     description: Raw OpenAPI 3.0 specification in JSON format
 *     tags: [Documentation]
 *     responses:
 *       200:
 *         description: OpenAPI specification
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get('/docs/openapi.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(swaggerSpec);
});

/**
 * @swagger
 * /docs/redoc:
 *   get:
 *     summary: ReDoc Documentation
 *     description: Alternative documentation viewer using ReDoc
 *     tags: [Documentation]
 *     responses:
 *       200:
 *         description: ReDoc documentation page
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 */
router.get('/docs/redoc', (req, res) => {
  const redocHtml = `
<!DOCTYPE html>
<html>
  <head>
    <title>Crypto Portfolio API - ReDoc</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>
      body { margin: 0; padding: 0; }
    </style>
  </head>
  <body>
    <redoc spec-url='/api/v1/docs/openapi.json'></redoc>
    <script src="https://cdn.jsdelivr.net/npm/redoc@2.1.3/bundles/redoc.standalone.js"></script>
  </body>
</html>`;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(redocHtml);
});

/**
 * @swagger
 * /docs/testing:
 *   get:
 *     summary: API Testing Interface
 *     description: Interactive API testing interface with pre-filled examples
 *     tags: [Documentation]
 *     responses:
 *       200:
 *         description: Testing interface
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 */
router.get('/docs/testing', (req, res) => {
  const testingHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Testing Interface</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem; border-radius: 8px; margin-bottom: 2rem; }
        .section { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .form-group { margin-bottom: 1rem; }
        label { display: block; font-weight: 600; margin-bottom: 0.5rem; }
        input, select, textarea { width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; }
        button { background: #3b82f6; color: white; padding: 0.75rem 1.5rem; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; }
        button:hover { background: #2563eb; }
        .response { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 1rem; margin-top: 1rem; }
        pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; }
        .endpoint { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
        .method { padding: 0.25rem 0.5rem; border-radius: 4px; font-weight: 600; font-size: 12px; }
        .method.get { background: #10b981; color: white; }
        .method.post { background: #3b82f6; color: white; }
        .method.put { background: #f59e0b; color: white; }
        .method.delete { background: #ef4444; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 API Testing Interface</h1>
            <p>Interactive testing for the Crypto Portfolio API</p>
        </div>

        <div class="section">
            <h2>Authentication</h2>
            <div class="form-group">
                <label>API Token:</label>
                <input type="text" id="authToken" placeholder="Enter your JWT token">
                <button onclick="testLogin()">Get Test Token</button>
            </div>
        </div>

        <div class="section">
            <h2>Quick Tests</h2>
            
            <div class="endpoint">
                <span class="method get">GET</span>
                <span>/api/v1/health</span>
                <button onclick="testEndpoint('GET', '/api/v1/health')">Test</button>
            </div>
            
            <div class="endpoint">
                <span class="method get">GET</span>
                <span>/api/v1/users/profile</span>
                <button onclick="testEndpoint('GET', '/api/v1/users/profile', true)">Test</button>
            </div>
            
            <div class="endpoint">
                <span class="method get">GET</span>
                <span>/api/v1/portfolios</span>
                <button onclick="testEndpoint('GET', '/api/v1/portfolios', true)">Test</button>
            </div>
            
            <div class="endpoint">
                <span class="method post">POST</span>
                <span>/api/v1/portfolios</span>
                <button onclick="testCreatePortfolio()">Test</button>
            </div>
        </div>

        <div class="section">
            <h2>Custom Request</h2>
            <div class="form-group">
                <label>Method:</label>
                <select id="customMethod">
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                </select>
            </div>
            <div class="form-group">
                <label>Endpoint:</label>
                <input type="text" id="customEndpoint" placeholder="/api/v1/...">
            </div>
            <div class="form-group">
                <label>Request Body (JSON):</label>
                <textarea id="customBody" rows="6" placeholder='{"key": "value"}'></textarea>
            </div>
            <button onclick="testCustomEndpoint()">Send Request</button>
        </div>

        <div class="section">
            <h2>Response</h2>
            <div id="response" class="response">
                <pre>No request sent yet...</pre>
            </div>
        </div>
    </div>

    <script>
        const API_BASE = window.location.origin + '/api/v1';
        
        async function testLogin() {
            try {
                const response = await fetch(API_BASE + '/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: 'test@example.com',
                        password: 'TestPassword123!'
                    })
                });
                
                const data = await response.json();
                if (data.success && data.data.token) {
                    document.getElementById('authToken').value = data.data.token;
                    displayResponse('Login successful! Token saved.', data);
                } else {
                    displayResponse('Login failed', data);
                }
            } catch (error) {
                displayResponse('Network error', { error: error.message });
            }
        }
        
        async function testEndpoint(method, endpoint, requiresAuth = false) {
            const headers = { 'Content-Type': 'application/json' };
            
            if (requiresAuth) {
                const token = document.getElementById('authToken').value;
                if (!token) {
                    displayResponse('Error: Token required', { error: 'Please get a test token first' });
                    return;
                }
                headers['Authorization'] = 'Bearer ' + token;
            }
            
            try {
                const response = await fetch(API_BASE + endpoint, { method, headers });
                const data = await response.json();
                displayResponse(\`\${method} \${endpoint} - Status: \${response.status}\`, data);
            } catch (error) {
                displayResponse('Network error', { error: error.message });
            }
        }
        
        async function testCreatePortfolio() {
            const token = document.getElementById('authToken').value;
            if (!token) {
                displayResponse('Error: Token required', { error: 'Please get a test token first' });
                return;
            }
            
            const body = {
                name: 'Test Portfolio ' + Date.now(),
                description: 'Created from testing interface',
                type: 'MANUAL'
            };
            
            try {
                const response = await fetch(API_BASE + '/portfolios', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify(body)
                });
                
                const data = await response.json();
                displayResponse(\`POST /portfolios - Status: \${response.status}\`, data);
            } catch (error) {
                displayResponse('Network error', { error: error.message });
            }
        }
        
        async function testCustomEndpoint() {
            const method = document.getElementById('customMethod').value;
            const endpoint = document.getElementById('customEndpoint').value;
            const bodyText = document.getElementById('customBody').value;
            
            if (!endpoint) {
                displayResponse('Error: Endpoint required', { error: 'Please enter an endpoint' });
                return;
            }
            
            const headers = { 'Content-Type': 'application/json' };
            const token = document.getElementById('authToken').value;
            if (token) {
                headers['Authorization'] = 'Bearer ' + token;
            }
            
            const options = { method, headers };
            
            if (bodyText && (method === 'POST' || method === 'PUT')) {
                try {
                    options.body = JSON.stringify(JSON.parse(bodyText));
                } catch (error) {
                    displayResponse('Error: Invalid JSON', { error: 'Request body is not valid JSON' });
                    return;
                }
            }
            
            try {
                const response = await fetch(API_BASE + endpoint, options);
                const data = await response.json();
                displayResponse(\`\${method} \${endpoint} - Status: \${response.status}\`, data);
            } catch (error) {
                displayResponse('Network error', { error: error.message });
            }
        }
        
        function displayResponse(title, data) {
            const responseDiv = document.getElementById('response');
            responseDiv.innerHTML = \`<strong>\${title}</strong>\\n\\n\${JSON.stringify(data, null, 2)}\`;
        }
    </script>
</body>
</html>`;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(testingHtml);
});

/**
 * @swagger
 * /docs/mock-server:
 *   get:
 *     summary: Mock Server Controls
 *     description: Interface to control and configure the mock API server
 *     tags: [Documentation]
 *     responses:
 *       200:
 *         description: Mock server control interface
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 */
router.get('/docs/mock-server', (req, res) => {
  const mockHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mock API Server Controls</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem; border-radius: 8px; margin-bottom: 2rem; }
        .section { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        button { background: #3b82f6; color: white; padding: 0.75rem 1.5rem; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; margin: 0.5rem; }
        button:hover { background: #2563eb; }
        button.danger { background: #ef4444; }
        button.danger:hover { background: #dc2626; }
        .status { padding: 1rem; border-radius: 4px; margin: 1rem 0; }
        .status.success { background: #d1fae5; border: 1px solid #10b981; color: #047857; }
        .status.error { background: #fee2e2; border: 1px solid #ef4444; color: #dc2626; }
        .mock-data { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 1rem; margin: 1rem 0; max-height: 300px; overflow-y: auto; }
        pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; font-size: 12px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
        .stat-card { background: #f8fafc; padding: 1rem; border-radius: 6px; text-align: center; }
        .stat-number { font-size: 2rem; font-weight: 700; color: #3b82f6; }
        .stat-label { font-size: 0.875rem; color: #6b7280; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎭 Mock API Server</h1>
            <p>Control and configure the mock API server for development and testing</p>
        </div>

        <div class="section">
            <h2>Server Status</h2>
            <div id="status" class="status">
                <strong>Status:</strong> Checking...
            </div>
            <button onclick="checkStatus()">Refresh Status</button>
            <button onclick="startMockServer()">Start Mock Server</button>
            <button onclick="resetMockData()" class="danger">Reset Mock Data</button>
        </div>

        <div class="section">
            <h2>Mock Database Statistics</h2>
            <div id="stats" class="grid">
                <div class="stat-card">
                    <div class="stat-number" id="userCount">-</div>
                    <div class="stat-label">Users</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="portfolioCount">-</div>
                    <div class="stat-label">Portfolios</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="transactionCount">-</div>
                    <div class="stat-label">Transactions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="exchangeCount">-</div>
                    <div class="stat-label">Exchanges</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>Configuration</h2>
            <p>The mock server provides realistic data for frontend development:</p>
            <ul>
                <li><strong>Base URL:</strong> <code>http://localhost:3002/api/v1</code></li>
                <li><strong>Authentication:</strong> Any Bearer token works</li>
                <li><strong>Rate Limiting:</strong> Simulated (configurable)</li>
                <li><strong>Latency:</strong> Add <code>?delay=500</code> to simulate network delays</li>
                <li><strong>Error Simulation:</strong> <code>/api/v1/mock/error/404</code></li>
            </ul>
        </div>

        <div class="section">
            <h2>Sample Mock Data</h2>
            <button onclick="showMockData('users')">Show Users</button>
            <button onclick="showMockData('portfolios')">Show Portfolios</button>
            <button onclick="showMockData('transactions')">Show Transactions</button>
            <button onclick="showMockData('marketData')">Show Market Data</button>
            
            <div id="mockData" class="mock-data" style="display: none;">
                <pre id="mockDataContent"></pre>
            </div>
        </div>

        <div class="section">
            <h2>Frontend Integration</h2>
            <p>To use the mock server in your frontend development:</p>
            <pre><code>// Set your API base URL to the mock server
const API_BASE = 'http://localhost:3002/api/v1';

// All endpoints work exactly like the real API
const response = await fetch(\`\${API_BASE}/portfolios\`, {
  headers: { 'Authorization': 'Bearer any-token-works' }
});

// Add artificial delays for testing loading states
const response = await fetch(\`\${API_BASE}/portfolios?delay=1000\`);</code></pre>
        </div>
    </div>

    <script>
        async function checkStatus() {
            try {
                const response = await fetch('http://localhost:3002/api/v1/health');
                const data = await response.json();
                
                if (response.ok) {
                    document.getElementById('status').className = 'status success';
                    document.getElementById('status').innerHTML = \`<strong>Status:</strong> Running (Version: \${data.version})\`;
                    updateStats();
                } else {
                    throw new Error('Server not responding');
                }
            } catch (error) {
                document.getElementById('status').className = 'status error';
                document.getElementById('status').innerHTML = '<strong>Status:</strong> Not running or not accessible';
            }
        }
        
        async function updateStats() {
            try {
                // These would be actual mock server endpoints
                document.getElementById('userCount').textContent = '10';
                document.getElementById('portfolioCount').textContent = '25';
                document.getElementById('transactionCount').textContent = '100';
                document.getElementById('exchangeCount').textContent = '3';
            } catch (error) {
                console.error('Failed to update stats:', error);
            }
        }
        
        function startMockServer() {
            alert('Mock server start command sent to backend. Check console for details.');
            // In a real implementation, this would send a command to start the mock server
        }
        
        function resetMockData() {
            if (confirm('Are you sure you want to reset all mock data?')) {
                alert('Mock data reset command sent. The mock server will be reinitialized.');
                // In a real implementation, this would reset the mock database
            }
        }
        
        async function showMockData(type) {
            const mockDataDiv = document.getElementById('mockData');
            const contentDiv = document.getElementById('mockDataContent');
            
            // Sample mock data for demonstration
            const sampleData = {
                users: [
                    { id: '1', email: 'user1@example.com', firstName: 'John', lastName: 'Doe' },
                    { id: '2', email: 'user2@example.com', firstName: 'Jane', lastName: 'Smith' }
                ],
                portfolios: [
                    { id: '1', name: 'Main Portfolio', type: 'MANUAL', totalValue: 125000 },
                    { id: '2', name: 'Trading Portfolio', type: 'EXCHANGE_SYNC', totalValue: 45000 }
                ],
                transactions: [
                    { id: '1', type: 'BUY', symbol: 'BTC', quantity: 0.5, price: 45000 },
                    { id: '2', type: 'BUY', symbol: 'ETH', quantity: 2, price: 3000 }
                ],
                marketData: [
                    { symbol: 'BTC', price: 65000, change24h: 2.5 },
                    { symbol: 'ETH', price: 4200, change24h: -1.2 }
                ]
            };
            
            contentDiv.textContent = JSON.stringify(sampleData[type] || [], null, 2);
            mockDataDiv.style.display = 'block';
        }
        
        // Check status on load
        checkStatus();
    </script>
</body>
</html>`;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(mockHtml);
});

/**
 * @swagger
 * /docs/tutorials:
 *   get:
 *     summary: API Tutorials and Guides
 *     description: Step-by-step tutorials for using the API
 *     tags: [Documentation]
 *     responses:
 *       200:
 *         description: Tutorials page
 */
router.get('/docs/tutorials', (req, res) => {
  const tutorialsHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Tutorials</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; line-height: 1.6; }
        .container { max-width: 900px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem; border-radius: 8px; margin-bottom: 2rem; }
        .tutorial { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 2rem; margin-bottom: 2rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .step { background: #f8fafc; border-left: 4px solid #3b82f6; padding: 1rem; margin: 1rem 0; }
        code { background: #f1f5f9; padding: 0.2rem 0.4rem; border-radius: 3px; font-family: 'Monaco', 'Menlo', monospace; }
        pre { background: #1e293b; color: #e2e8f0; padding: 1rem; border-radius: 6px; overflow-x: auto; }
        .note { background: #fef3c7; border: 1px solid #f59e0b; padding: 1rem; border-radius: 4px; margin: 1rem 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📚 API Tutorials</h1>
            <p>Step-by-step guides to get you started with the Crypto Portfolio API</p>
        </div>

        <div class="tutorial">
            <h2>🚀 Getting Started</h2>
            <p>Learn how to authenticate and make your first API calls.</p>
            
            <div class="step">
                <h3>Step 1: Register a User Account</h3>
                <pre><code>POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "your@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe"
}</code></pre>
            </div>

            <div class="step">
                <h3>Step 2: Login and Get Token</h3>
                <pre><code>POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "your@example.com",
  "password": "SecurePassword123!"
}

// Response
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "...",
    "user": { ... }
  }
}</code></pre>
            </div>

            <div class="step">
                <h3>Step 3: Make Authenticated Requests</h3>
                <pre><code>GET /api/v1/users/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...</code></pre>
            </div>
        </div>

        <div class="tutorial">
            <h2>💼 Portfolio Management</h2>
            
            <div class="step">
                <h3>Create Your First Portfolio</h3>
                <pre><code>POST /api/v1/portfolios
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "name": "My Crypto Portfolio",
  "description": "Main investment portfolio",
  "type": "MANUAL",
  "isDefault": true
}</code></pre>
            </div>

            <div class="step">
                <h3>Add Transactions</h3>
                <pre><code>POST /api/v1/portfolios/{portfolioId}/transactions
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "type": "BUY",
  "symbol": "BTC",
  "quantity": 0.5,
  "price": 45000,
  "fee": 25,
  "executedAt": "2024-01-15T10:30:00Z",
  "notes": "Initial Bitcoin purchase"
}</code></pre>
            </div>

            <div class="step">
                <h3>View Portfolio Performance</h3>
                <pre><code>GET /api/v1/portfolios/{portfolioId}/performance?period=30d
Authorization: Bearer YOUR_TOKEN</code></pre>
            </div>
        </div>

        <div class="tutorial">
            <h2>📊 Advanced Features</h2>
            
            <div class="step">
                <h3>Bulk Transaction Import</h3>
                <pre><code>POST /api/v1/portfolios/{portfolioId}/transactions/bulk
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "transactions": [
    {
      "type": "BUY",
      "symbol": "BTC",
      "quantity": 0.5,
      "price": 45000,
      "executedAt": "2024-01-15T10:30:00Z"
    },
    {
      "type": "BUY", 
      "symbol": "ETH",
      "quantity": 2,
      "price": 3000,
      "executedAt": "2024-01-15T11:00:00Z"
    }
  ]
}</code></pre>
            </div>

            <div class="step">
                <h3>Export Data</h3>
                <pre><code>POST /api/v1/users/export-data
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "format": "json"
}

// Then check export status
GET /api/v1/users/export-data/{exportId}
Authorization: Bearer YOUR_TOKEN</code></pre>
            </div>
        </div>

        <div class="tutorial">
            <h2>🔒 Security Best Practices</h2>
            
            <div class="note">
                <h3>⚠️ Important Security Notes</h3>
                <ul>
                    <li>Never expose your JWT tokens in client-side code</li>
                    <li>Store tokens securely (httpOnly cookies recommended)</li>
                    <li>Implement token refresh logic</li>
                    <li>Enable 2FA for enhanced security</li>
                    <li>Use HTTPS in production</li>
                </ul>
            </div>

            <div class="step">
                <h3>Enable Two-Factor Authentication</h3>
                <pre><code>POST /api/v1/auth/enable-2fa
Authorization: Bearer YOUR_TOKEN

// Response includes QR code for setup
{
  "success": true,
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCode": "data:image/png;base64,...",
    "backupCodes": ["ABCD1234", "EFGH5678", ...]
  }
}</code></pre>
            </div>

            <div class="step">
                <h3>Handle Token Refresh</h3>
                <pre><code>// When access token expires (401 response)
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "your-refresh-token"
}

// Response
{
  "success": true,
  "data": {
    "token": "new-access-token",
    "refreshToken": "new-refresh-token"
  }
}</code></pre>
            </div>
        </div>

        <div class="tutorial">
            <h2>📈 Working with Market Data</h2>
            
            <div class="step">
                <h3>Get Current Prices</h3>
                <pre><code>GET /api/v1/market/prices
Authorization: Bearer YOUR_TOKEN

// Get specific symbol
GET /api/v1/market/prices/BTC
Authorization: Bearer YOUR_TOKEN</code></pre>
            </div>
        </div>

        <div class="tutorial">
            <h2>🚨 Error Handling</h2>
            
            <div class="step">
                <h3>Common Error Responses</h3>
                <pre><code>// 400 Bad Request
{
  "success": false,
  "error": "Validation Error",
  "message": "Request validation failed",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}

// 401 Unauthorized
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid or missing authentication token"
}

// 429 Rate Limit
{
  "success": false,
  "error": "Rate Limit Exceeded",
  "message": "Too many requests, please try again later",
  "retryAfter": 900
}</code></pre>
            </div>
        </div>
    </div>
</body>
</html>`;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(tutorialsHtml);
});

/**
 * Setup documentation routes
 */
export function setupDocumentationRoutes(app: any): void {
  // Initialize enhanced documentation
  docGenerator.setupDocumentation();
  
  // Mount routes
  app.use('/api/v1', router);
  
  logger.info('📚 Enhanced documentation routes configured');
}

export default router;