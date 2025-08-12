# CI/CD Pipeline Architecture with GitHub Actions

## Overview
Comprehensive CI/CD pipeline using GitHub Actions for automated testing, building, security scanning, and deployment of the crypto portfolio microservices architecture.

## Pipeline Architecture

### CI/CD Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Developer Workflow                      │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│  │   Feature   │───▶│  Pull Req   │───▶│    Merge    │    │
│  │   Branch    │    │   Review    │    │  to Main    │    │
│  └─────────────┘    └─────────────┘    └─────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Continuous Integration                    │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │    Code     │  │   Security  │  │    Unit     │        │
│  │  Quality    │  │  Scanning   │  │   Tests     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │Integration  │  │   Docker    │  │   Image     │        │
│  │   Tests     │  │    Build    │  │  Security   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                 Continuous Deployment                      │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Deploy    │  │   Deploy    │  │   Deploy    │        │
│  │Development  │  │   Staging   │  │ Production  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Smoke     │  │   E2E       │  │  Rollback   │        │
│  │   Tests     │  │   Tests     │  │ Capability  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### GitHub Actions Workflows

#### Main CI/CD Workflow

```yaml
# .github/workflows/main.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  release:
    types: [published]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: crypto-portfolio
  NODE_VERSION: '18'
  PYTHON_VERSION: '3.11'

jobs:
  # Job 1: Code Quality and Security
  code-quality:
    name: Code Quality & Security
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      with:
        fetch-depth: 0  # Shallow clones should be disabled for better analysis

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: ESLint
      run: npm run lint:ci
      continue-on-error: false

    - name: Prettier check
      run: npm run format:check

    - name: TypeScript check
      run: npm run type-check

    - name: SonarCloud Scan
      uses: SonarSource/sonarcloud-github-action@master
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

    - name: CodeQL Analysis
      uses: github/codeql-action/init@v3
      with:
        languages: typescript, javascript

    - name: Perform CodeQL Analysis
      uses: github/codeql-action/analyze@v3

    - name: SAST with Semgrep
      uses: returntocorp/semgrep-action@v1
      with:
        config: auto
      env:
        SEMGREP_APP_TOKEN: ${{ secrets.SEMGREP_APP_TOKEN }}

    - name: Dependency vulnerability scan
      run: npm audit --audit-level high

    - name: License compliance check
      uses: fossas/fossa-action@main
      with:
        api-key: ${{ secrets.FOSSA_API_KEY }}

  # Job 2: Unit Tests
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [auth, portfolio, market-data, analytics, notification, file-processing]
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run unit tests for ${{ matrix.service }}
      run: npm run test:unit:${{ matrix.service }}
      env:
        CI: true
        NODE_ENV: test

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        token: ${{ secrets.CODECOV_TOKEN }}
        flags: ${{ matrix.service }}
        name: ${{ matrix.service }}-coverage

  # Job 3: Integration Tests
  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: [code-quality, unit-tests]
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: crypto_portfolio_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

      mongodb:
        image: mongo:6
        env:
          MONGO_INITDB_ROOT_USERNAME: admin
          MONGO_INITDB_ROOT_PASSWORD: admin
        options: >-
          --health-cmd "mongosh --eval 'db.adminCommand(\"ping\")'"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 27017:27017

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Wait for services
      run: |
        npx wait-port 5432 && \
        npx wait-port 6379 && \
        npx wait-port 27017

    - name: Run database migrations
      run: npm run db:migrate
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/crypto_portfolio_test

    - name: Run integration tests
      run: npm run test:integration
      env:
        NODE_ENV: test
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/crypto_portfolio_test
        REDIS_URL: redis://localhost:6379
        MONGODB_URL: mongodb://admin:admin@localhost:27017/crypto_portfolio_test?authSource=admin

    - name: Upload test results
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: integration-test-results
        path: |
          coverage/
          test-results/

  # Job 4: Build and Push Docker Images
  build-images:
    name: Build Docker Images
    runs-on: ubuntu-latest
    needs: [integration-tests]
    strategy:
      matrix:
        service: [auth, portfolio, market-data, analytics, notification, file-processing, api-gateway]
    permissions:
      contents: read
      packages: write
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Login to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ github.repository }}/${{ matrix.service }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha,prefix={{branch}}-
          type=semver,pattern={{version}}
          type=semver,pattern={{major}}.{{minor}}

    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        file: ./services/${{ matrix.service }}/Dockerfile
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
        platforms: linux/amd64,linux/arm64

    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: ${{ env.REGISTRY }}/${{ github.repository }}/${{ matrix.service }}:${{ github.sha }}
        format: 'sarif'
        output: 'trivy-results.sarif'

    - name: Upload Trivy scan results
      uses: github/codeql-action/upload-sarif@v3
      with:
        sarif_file: 'trivy-results.sarif'

  # Job 5: Deploy to Development
  deploy-dev:
    name: Deploy to Development
    runs-on: ubuntu-latest
    needs: [build-images]
    if: github.ref == 'refs/heads/develop'
    environment:
      name: development
      url: https://dev-api.crypto-portfolio.com
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: 'v1.28.0'

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-west-2

    - name: Update kubeconfig
      run: aws eks update-kubeconfig --name crypto-portfolio-dev --region us-west-2

    - name: Deploy to Kubernetes
      run: |
        envsubst < k8s/overlays/development/kustomization.yaml | kubectl apply -f -
        kubectl rollout restart deployment -n crypto-portfolio-dev
        kubectl rollout status deployment -n crypto-portfolio-dev --timeout=600s
      env:
        IMAGE_TAG: ${{ github.sha }}
        ENVIRONMENT: development

    - name: Run smoke tests
      run: npm run test:smoke
      env:
        BASE_URL: https://dev-api.crypto-portfolio.com

    - name: Notify Slack on success
      if: success()
      uses: 8398a7/action-slack@v3
      with:
        status: success
        channel: '#deployments'
        text: '✅ Development deployment successful'
      env:
        SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

    - name: Notify Slack on failure
      if: failure()
      uses: 8398a7/action-slack@v3
      with:
        status: failure
        channel: '#deployments'
        text: '❌ Development deployment failed'
      env:
        SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

  # Job 6: Deploy to Staging
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: [build-images]
    if: github.ref == 'refs/heads/main'
    environment:
      name: staging
      url: https://staging-api.crypto-portfolio.com
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: 'v1.28.0'

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-west-2

    - name: Update kubeconfig
      run: aws eks update-kubeconfig --name crypto-portfolio-staging --region us-west-2

    - name: Deploy to Kubernetes
      run: |
        envsubst < k8s/overlays/staging/kustomization.yaml | kubectl apply -f -
        kubectl rollout restart deployment -n crypto-portfolio-staging
        kubectl rollout status deployment -n crypto-portfolio-staging --timeout=600s
      env:
        IMAGE_TAG: ${{ github.sha }}
        ENVIRONMENT: staging

    - name: Run E2E tests
      run: npm run test:e2e
      env:
        BASE_URL: https://staging-api.crypto-portfolio.com
        E2E_TEST_USER_EMAIL: ${{ secrets.E2E_TEST_USER_EMAIL }}
        E2E_TEST_USER_PASSWORD: ${{ secrets.E2E_TEST_USER_PASSWORD }}

    - name: Performance tests
      run: npm run test:performance
      env:
        BASE_URL: https://staging-api.crypto-portfolio.com

    - name: Upload test results
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: e2e-test-results
        path: |
          e2e-results/
          performance-results/

  # Job 7: Deploy to Production
  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [deploy-staging]
    if: github.event_name == 'release' && github.event.action == 'published'
    environment:
      name: production
      url: https://api.crypto-portfolio.com
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: 'v1.28.0'

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-west-2

    - name: Update kubeconfig
      run: aws eks update-kubeconfig --name crypto-portfolio-prod --region us-west-2

    - name: Create deployment backup
      run: |
        kubectl get deployment -n crypto-portfolio-prod -o yaml > deployment-backup.yaml
        kubectl get configmap -n crypto-portfolio-prod -o yaml > configmap-backup.yaml

    - name: Deploy to Production (Blue-Green)
      run: |
        # Deploy to green environment
        envsubst < k8s/overlays/production/kustomization-green.yaml | kubectl apply -f -
        kubectl rollout status deployment -n crypto-portfolio-prod-green --timeout=600s
        
        # Health check green environment
        kubectl wait --for=condition=ready pod -l app.kubernetes.io/env=green -n crypto-portfolio-prod --timeout=300s
        
        # Switch traffic to green
        kubectl patch service crypto-portfolio-prod -n crypto-portfolio-prod -p '{"spec":{"selector":{"app.kubernetes.io/env":"green"}}}'
        
        # Wait and verify
        sleep 60
        
        # If successful, clean up blue environment
        kubectl delete deployment -l app.kubernetes.io/env=blue -n crypto-portfolio-prod || true
      env:
        IMAGE_TAG: ${{ github.event.release.tag_name }}
        ENVIRONMENT: production

    - name: Run production smoke tests
      run: npm run test:smoke:production
      env:
        BASE_URL: https://api.crypto-portfolio.com

    - name: Update deployment status
      if: success()
      run: |
        curl -X POST \
          -H "Authorization: token ${{ secrets.GITHUB_TOKEN }}" \
          -H "Accept: application/vnd.github.v3+json" \
          https://api.github.com/repos/${{ github.repository }}/deployments \
          -d '{
            "ref": "${{ github.event.release.tag_name }}",
            "environment": "production",
            "description": "Production deployment successful"
          }'

    - name: Rollback on failure
      if: failure()
      run: |
        # Rollback to previous version
        kubectl rollout undo deployment -n crypto-portfolio-prod
        kubectl rollout status deployment -n crypto-portfolio-prod --timeout=300s
        
        # Notify about rollback
        echo "Production deployment failed, rolled back to previous version"

    - name: Notify teams
      if: always()
      uses: 8398a7/action-slack@v3
      with:
        status: ${{ job.status }}
        channel: '#production-deployments'
        text: |
          Production deployment ${{ job.status }}
          Version: ${{ github.event.release.tag_name }}
          Commit: ${{ github.sha }}
      env:
        SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

#### Pull Request Workflow

```yaml
# .github/workflows/pr.yml
name: Pull Request CI

on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches: [main, develop]

jobs:
  validate-pr:
    name: Validate Pull Request
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Validate PR title
      uses: amannn/action-semantic-pull-request@v5
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

    - name: Check for breaking changes
      run: |
        if git diff --name-only origin/main..HEAD | grep -E "(package\.json|package-lock\.json|Dockerfile|k8s/)" ; then
          echo "::warning::This PR contains potentially breaking changes"
        fi

    - name: Lint commit messages
      uses: wagoid/commitlint-github-action@v5

  security-scan:
    name: Security Scan
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Run GitLeaks
      uses: gitleaks/gitleaks-action@v2
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

    - name: Run Snyk security scan
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
      with:
        args: --severity-threshold=high

  preview-deployment:
    name: Preview Deployment
    runs-on: ubuntu-latest
    if: contains(github.event.pull_request.labels.*.name, 'deploy-preview')
    environment:
      name: preview-pr-${{ github.event.number }}
      url: https://pr-${{ github.event.number }}.preview.crypto-portfolio.com
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Deploy preview environment
      run: |
        # Deploy to preview namespace
        kubectl create namespace crypto-portfolio-pr-${{ github.event.number }} || true
        envsubst < k8s/overlays/preview/kustomization.yaml | kubectl apply -f -
      env:
        PR_NUMBER: ${{ github.event.number }}
        IMAGE_TAG: pr-${{ github.event.number }}

    - name: Comment PR with preview URL
      uses: actions/github-script@v7
      with:
        script: |
          github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: '🚀 Preview deployment available at: https://pr-${{ github.event.number }}.preview.crypto-portfolio.com'
          })

  cleanup-preview:
    name: Cleanup Preview
    runs-on: ubuntu-latest
    if: github.event.action == 'closed'
    steps:
    - name: Cleanup preview environment
      run: |
        kubectl delete namespace crypto-portfolio-pr-${{ github.event.number }} || true
```

#### Security Scanning Workflow

```yaml
# .github/workflows/security.yml
name: Security Scanning

on:
  schedule:
    - cron: '0 2 * * *'  # Run daily at 2 AM
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  dependency-scan:
    name: Dependency Security Scan
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Audit npm dependencies
      run: npm audit --audit-level moderate

    - name: Run Snyk test
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

    - name: Upload Snyk results to GitHub Code Scanning
      uses: github/codeql-action/upload-sarif@v3
      with:
        sarif_file: snyk.sarif

  container-scan:
    name: Container Security Scan
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [auth, portfolio, market-data, analytics]
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Build Docker image
      run: |
        docker build -t test-image:latest -f services/${{ matrix.service }}/Dockerfile .

    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: 'test-image:latest'
        format: 'sarif'
        output: 'trivy-results.sarif'

    - name: Upload Trivy scan results
      uses: github/codeql-action/upload-sarif@v3
      with:
        sarif_file: 'trivy-results.sarif'

  infrastructure-scan:
    name: Infrastructure Security Scan
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Run Checkov
      uses: bridgecrewio/checkov-action@master
      with:
        directory: k8s/
        framework: kubernetes
        output_format: sarif
        output_file_path: checkov-results.sarif

    - name: Upload Checkov scan results
      uses: github/codeql-action/upload-sarif@v3
      with:
        sarif_file: checkov-results.sarif

    - name: Scan Terraform files
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'config'
        scan-ref: 'terraform/'
        format: 'sarif'
        output: 'trivy-terraform.sarif'

    - name: Upload Terraform scan results
      uses: github/codeql-action/upload-sarif@v3
      with:
        sarif_file: 'trivy-terraform.sarif'
```

#### Release Workflow

```yaml
# .github/workflows/release.yml
name: Release

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Release version (e.g., v1.2.3)'
        required: true
        type: string
      pre_release:
        description: 'Mark as pre-release'
        required: false
        type: boolean
        default: false

jobs:
  create-release:
    name: Create Release
    runs-on: ubuntu-latest
    permissions:
      contents: write
      packages: write
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Update version
      run: |
        npm version ${{ github.event.inputs.version }} --no-git-tag-version
        git config --local user.email "action@github.com"
        git config --local user.name "GitHub Action"
        git add package*.json
        git commit -m "chore: bump version to ${{ github.event.inputs.version }}"

    - name: Generate changelog
      id: changelog
      run: |
        npx conventional-changelog-cli -p angular -i CHANGELOG.md -s
        echo "CHANGELOG<<EOF" >> $GITHUB_OUTPUT
        cat CHANGELOG.md | head -n 50 >> $GITHUB_OUTPUT
        echo "EOF" >> $GITHUB_OUTPUT

    - name: Create Git tag
      run: |
        git tag ${{ github.event.inputs.version }}
        git push origin ${{ github.event.inputs.version }}

    - name: Build release artifacts
      run: |
        npm run build
        tar -czf crypto-portfolio-${{ github.event.inputs.version }}.tar.gz dist/

    - name: Create GitHub Release
      uses: actions/create-release@v1
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      with:
        tag_name: ${{ github.event.inputs.version }}
        release_name: Release ${{ github.event.inputs.version }}
        body: |
          ## Changes
          ${{ steps.changelog.outputs.CHANGELOG }}
          
          ## Docker Images
          - `ghcr.io/${{ github.repository }}/auth:${{ github.event.inputs.version }}`
          - `ghcr.io/${{ github.repository }}/portfolio:${{ github.event.inputs.version }}`
          - `ghcr.io/${{ github.repository }}/market-data:${{ github.event.inputs.version }}`
          - `ghcr.io/${{ github.repository }}/analytics:${{ github.event.inputs.version }}`
        draft: false
        prerelease: ${{ github.event.inputs.pre_release }}

    - name: Upload release artifacts
      uses: actions/upload-release-asset@v1
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      with:
        upload_url: ${{ steps.create_release.outputs.upload_url }}
        asset_path: ./crypto-portfolio-${{ github.event.inputs.version }}.tar.gz
        asset_name: crypto-portfolio-${{ github.event.inputs.version }}.tar.gz
        asset_content_type: application/gzip
```

### Testing Strategy

#### Unit Testing Configuration

```typescript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/*.test.ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**/*',
    '!src/migrations/**/*'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000
};
```

#### E2E Testing with Playwright

```typescript
// tests/e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/e2e-results.xml' }],
    ['github']
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] }
    }
  ],
  webServer: process.env.CI ? undefined : {
    command: 'npm run start:test',
    port: 3000,
    reuseExistingServer: !process.env.CI
  }
});
```

#### Performance Testing with k6

```javascript
// tests/performance/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export let errorRate = new Rate('errors');

export let options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up
    { duration: '5m', target: 50 }, // Stay at 50 users
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
    http_req_failed: ['rate<0.05'], // Error rate must be below 5%
    errors: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Test authentication
  let loginResponse = http.post(`${BASE_URL}/api/v1/auth/login`, {
    email: 'test@example.com',
    password: 'password123'
  });

  let loginCheck = check(loginResponse, {
    'login status is 200': (r) => r.status === 200,
    'login response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!loginCheck);

  if (loginCheck) {
    let token = loginResponse.json('accessToken');
    
    // Test portfolio endpoints
    let portfolioResponse = http.get(`${BASE_URL}/api/v1/portfolio`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    let portfolioCheck = check(portfolioResponse, {
      'portfolio status is 200': (r) => r.status === 200,
      'portfolio response time < 1000ms': (r) => r.timings.duration < 1000,
    });

    errorRate.add(!portfolioCheck);

    // Test market data endpoints
    let marketResponse = http.get(`${BASE_URL}/api/v1/market/prices`);

    let marketCheck = check(marketResponse, {
      'market data status is 200': (r) => r.status === 200,
      'market data response time < 500ms': (r) => r.timings.duration < 500,
    });

    errorRate.add(!marketCheck);
  }

  sleep(1);
}
```

### Deployment Configurations

#### Kustomization for Different Environments

```yaml
# k8s/overlays/development/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: crypto-portfolio-dev

resources:
- ../../base

images:
- name: crypto-portfolio/auth
  newTag: ${IMAGE_TAG}
- name: crypto-portfolio/portfolio
  newTag: ${IMAGE_TAG}
- name: crypto-portfolio/market-data
  newTag: ${IMAGE_TAG}

patchesStrategicMerge:
- deployment-patch.yaml
- service-patch.yaml

configMapGenerator:
- name: app-config
  env: config.env

secretGenerator:
- name: app-secrets
  env: secrets.env

replicas:
- name: auth-service
  count: 1
- name: portfolio-service
  count: 1
- name: market-data-service
  count: 1
```

#### GitHub Environment Configuration

```yaml
# .github/environments/production.yml
name: production
protection_rules:
  required_reviewers:
    users: ["tech-lead-1", "tech-lead-2"]
  wait_timer: 5  # 5 minutes wait time
  prevent_self_review: true
deployment_branch_policy:
  protected_branches: true
secrets:
  AWS_ACCESS_KEY_ID: ${{ secrets.PROD_AWS_ACCESS_KEY_ID }}
  AWS_SECRET_ACCESS_KEY: ${{ secrets.PROD_AWS_SECRET_ACCESS_KEY }}
  DATABASE_PASSWORD: ${{ secrets.PROD_DATABASE_PASSWORD }}
  JWT_SECRET: ${{ secrets.PROD_JWT_SECRET }}
```

This CI/CD pipeline architecture provides:
- **Comprehensive Testing**: Unit, integration, E2E, and performance tests
- **Security Scanning**: Code analysis, dependency scanning, and container security
- **Multi-Environment Deployment**: Automated deployments to dev, staging, and production
- **Blue-Green Deployment**: Zero-downtime production deployments
- **Rollback Capability**: Automatic rollback on deployment failures
- **Quality Gates**: Code quality and security checks before deployment
- **Monitoring Integration**: Comprehensive observability and alerting
- **Compliance**: Audit trails and approval workflows for production deployments