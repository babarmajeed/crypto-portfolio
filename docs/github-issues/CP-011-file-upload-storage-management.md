# CP-011: File Upload and Storage Management

## Objective
Implement a comprehensive file upload and storage system for handling user profile pictures, portfolio export files, transaction import files, and document attachments with cloud storage integration and security features.

## Priority
Medium

## Category
Backend Services

## Acceptance Criteria
- [ ] Secure file upload API with validation and sanitization
- [ ] Cloud storage integration (AWS S3/Cloudinary)
- [ ] Multiple file format support (CSV, JSON, PDF, images)
- [ ] File size and type restrictions with configurable limits
- [ ] Virus scanning and malware detection
- [ ] Image optimization and resizing for profile pictures
- [ ] CDN integration for fast file delivery
- [ ] File access control and signed URLs
- [ ] Automatic file cleanup for temporary uploads
- [ ] Upload progress tracking for large files

## Technical Implementation Details

### File Upload Service
```javascript
// services/fileUploadService.js
const multer = require('multer');
const AWS = require('aws-sdk');
const sharp = require('sharp');
const crypto = require('crypto');
const path = require('path');

class FileUploadService {
  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
    });
    
    this.bucket = process.env.AWS_S3_BUCKET;
    this.cdnUrl = process.env.CLOUDFRONT_URL;
  }

  getMulterConfig(fileType) {
    const storage = multer.memoryStorage();
    
    const fileFilter = (req, file, cb) => {
      const allowedTypes = this.getAllowedTypes(fileType);
      
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`));
      }
    };

    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: this.getMaxFileSize(fileType),
        files: 10
      }
    });
  }

  getAllowedTypes(fileType) {
    const types = {
      image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      document: ['application/pdf', 'text/csv', 'application/json'],
      csv: ['text/csv', 'application/vnd.ms-excel'],
      any: ['image/jpeg', 'image/png', 'text/csv', 'application/pdf', 'application/json']
    };
    
    return types[fileType] || types.any;
  }

  getMaxFileSize(fileType) {
    const sizes = {
      image: 5 * 1024 * 1024, // 5MB
      document: 10 * 1024 * 1024, // 10MB
      csv: 50 * 1024 * 1024, // 50MB
      any: 10 * 1024 * 1024 // 10MB
    };
    
    return sizes[fileType] || sizes.any;
  }

  async uploadToS3(file, folder, userId) {
    const fileExtension = path.extname(file.originalname);
    const fileName = `${crypto.randomUUID()}${fileExtension}`;
    const key = `${folder}/${userId}/${fileName}`;

    const params = {
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ServerSideEncryption: 'AES256',
      Metadata: {
        originalName: file.originalname,
        uploadDate: new Date().toISOString(),
        userId: userId.toString()
      }
    };

    try {
      const result = await this.s3.upload(params).promise();
      
      // Save file metadata to database
      const fileRecord = await File.create({
        userId,
        originalName: file.originalname,
        fileName,
        key,
        size: file.size,
        mimetype: file.mimetype,
        url: result.Location,
        cdnUrl: `${this.cdnUrl}/${key}`,
        folder
      });

      return fileRecord;
    } catch (error) {
      console.error('S3 upload failed:', error);
      throw new Error('File upload failed');
    }
  }

  async processImage(file, options = {}) {
    const {
      width = 400,
      height = 400,
      quality = 85,
      format = 'jpeg'
    } = options;

    try {
      const processedBuffer = await sharp(file.buffer)
        .resize(width, height, { 
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality })
        .toBuffer();

      return {
        ...file,
        buffer: processedBuffer,
        size: processedBuffer.length
      };
    } catch (error) {
      console.error('Image processing failed:', error);
      throw new Error('Image processing failed');
    }
  }

  async generateSignedUrl(key, expiresIn = 3600) {
    const params = {
      Bucket: this.bucket,
      Key: key,
      Expires: expiresIn
    };

    try {
      return await this.s3.getSignedUrlPromise('getObject', params);
    } catch (error) {
      console.error('Signed URL generation failed:', error);
      throw new Error('Failed to generate file access URL');
    }
  }

  async deleteFile(key) {
    const params = {
      Bucket: this.bucket,
      Key: key
    };

    try {
      await this.s3.deleteObject(params).promise();
      
      // Remove from database
      await File.destroy({ where: { key } });
      
      return true;
    } catch (error) {
      console.error('File deletion failed:', error);
      return false;
    }
  }
}
```

### Upload Controllers
```javascript
// controllers/uploadController.js
class UploadController {
  constructor() {
    this.fileService = new FileUploadService();
  }

  async uploadProfilePicture(req, res) {
    try {
      const upload = this.fileService.getMulterConfig('image').single('profilePicture');
      
      upload(req, res, async (err) => {
        if (err) {
          return res.status(400).json({ error: err.message });
        }

        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        // Process image (resize, optimize)
        const processedFile = await this.fileService.processImage(req.file, {
          width: 200,
          height: 200,
          quality: 90
        });

        // Upload to S3
        const fileRecord = await this.fileService.uploadToS3(
          processedFile,
          'profile-pictures',
          req.user.id
        );

        // Update user profile
        await User.update(
          { profilePictureUrl: fileRecord.cdnUrl },
          { where: { id: req.user.id } }
        );

        res.json({
          success: true,
          file: {
            id: fileRecord.id,
            url: fileRecord.cdnUrl,
            size: fileRecord.size
          }
        });
      });
    } catch (error) {
      console.error('Profile picture upload failed:', error);
      res.status(500).json({ error: 'Upload failed' });
    }
  }

  async uploadTransactionFile(req, res) {
    try {
      const upload = this.fileService.getMulterConfig('csv').single('transactionFile');
      
      upload(req, res, async (err) => {
        if (err) {
          return res.status(400).json({ error: err.message });
        }

        // Validate CSV format
        const isValid = await this.validateTransactionCSV(req.file.buffer);
        if (!isValid) {
          return res.status(400).json({ 
            error: 'Invalid CSV format. Please check the required columns.' 
          });
        }

        // Upload to S3
        const fileRecord = await this.fileService.uploadToS3(
          req.file,
          'transaction-imports',
          req.user.id
        );

        // Queue file processing
        await queues.fileProcessing.add('processTransactionFile', {
          fileId: fileRecord.id,
          userId: req.user.id
        });

        res.json({
          success: true,
          file: {
            id: fileRecord.id,
            name: fileRecord.originalName,
            status: 'processing'
          }
        });
      });
    } catch (error) {
      console.error('Transaction file upload failed:', error);
      res.status(500).json({ error: 'Upload failed' });
    }
  }

  async validateTransactionCSV(buffer) {
    try {
      const csv = buffer.toString();
      const lines = csv.split('\n');
      const headers = lines[0].toLowerCase().split(',');
      
      const requiredColumns = ['date', 'symbol', 'type', 'amount', 'price'];
      
      return requiredColumns.every(col => 
        headers.some(header => header.trim().includes(col))
      );
    } catch (error) {
      return false;
    }
  }

  async getFileDownload(req, res) {
    try {
      const { fileId } = req.params;
      
      const file = await File.findOne({
        where: { 
          id: fileId,
          userId: req.user.id 
        }
      });

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Generate signed URL for secure download
      const downloadUrl = await this.fileService.generateSignedUrl(file.key, 300); // 5 minutes

      res.json({
        success: true,
        downloadUrl,
        expiresIn: 300
      });
    } catch (error) {
      console.error('File download failed:', error);
      res.status(500).json({ error: 'Download failed' });
    }
  }
}
```

### File Processing Queue
```javascript
// jobs/fileProcessingJob.js
class FileProcessingJob {
  static async process(job) {
    const { fileId, userId } = job.data;
    
    try {
      const file = await File.findById(fileId);
      
      if (file.folder === 'transaction-imports') {
        await this.processTransactionFile(file, userId);
      }
      
      // Update file status
      await File.update(
        { status: 'processed' },
        { where: { id: fileId } }
      );
      
      // Notify user
      await notificationService.sendFileProcessedNotification(userId, file);
      
      return { success: true, processedFile: file.originalName };
    } catch (error) {
      // Update file status to failed
      await File.update(
        { status: 'failed', error: error.message },
        { where: { id: fileId } }
      );
      
      throw error;
    }
  }

  static async processTransactionFile(file, userId) {
    const fileService = new FileUploadService();
    
    // Download file from S3
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: file.key
    };
    
    const s3Object = await fileService.s3.getObject(params).promise();
    const csvData = s3Object.Body.toString();
    
    // Parse CSV
    const transactions = await this.parseTransactionCSV(csvData);
    
    // Validate and import transactions
    for (const transactionData of transactions) {
      await Transaction.createFromImport(userId, transactionData);
    }
  }

  static async parseTransactionCSV(csvData) {
    const csv = require('csv-parser');
    const { Readable } = require('stream');
    
    return new Promise((resolve, reject) => {
      const results = [];
      
      Readable.from(csvData)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }
}
```

## Required Technologies
- **AWS S3** - Cloud file storage
- **Multer** - File upload middleware
- **Sharp** - Image processing
- **AWS CloudFront** - CDN
- **csv-parser** - CSV file processing
- **ClamAV** - Virus scanning (optional)

## Testing Requirements

### Unit Tests
```javascript
describe('FileUploadService', () => {
  test('should upload file to S3 successfully', async () => {
    const mockFile = {
      originalname: 'test.jpg',
      buffer: Buffer.from('fake image data'),
      size: 1024,
      mimetype: 'image/jpeg'
    };

    const result = await fileService.uploadToS3(mockFile, 'test-folder', 1);
    
    expect(result.originalName).toBe('test.jpg');
    expect(result.url).toContain('amazonaws.com');
  });

  test('should process image correctly', async () => {
    const mockImageBuffer = await fs.readFile('test/fixtures/test-image.jpg');
    const mockFile = {
      buffer: mockImageBuffer
    };

    const processed = await fileService.processImage(mockFile, {
      width: 100,
      height: 100
    });

    expect(processed.buffer).toBeDefined();
    expect(processed.size).toBeLessThan(mockImageBuffer.length);
  });
});
```

### Integration Tests
```javascript
describe('File Upload API', () => {
  test('should upload profile picture', async () => {
    const response = await request(app)
      .post('/api/upload/profile-picture')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('profilePicture', 'test/fixtures/profile.jpg')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.file.url).toBeDefined();
  });

  test('should reject invalid file types', async () => {
    await request(app)
      .post('/api/upload/profile-picture')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('profilePicture', 'test/fixtures/document.pdf')
      .expect(400);
  });
});
```

## Dependencies
- CP-009: Background Job Processing and Queues
- CP-002: User Authentication and Authorization
- CP-001: Database Design and Schema

## File Types and Limits

### Supported File Types
1. **Images**: JPEG, PNG, GIF, WebP (max 5MB)
2. **Documents**: PDF (max 10MB)
3. **Data Files**: CSV, JSON (max 50MB)
4. **Exports**: CSV, JSON, PDF (max 100MB)

### Storage Structure
```
bucket/
├── profile-pictures/
│   └── {userId}/
├── transaction-imports/
│   └── {userId}/
├── portfolio-exports/
│   └── {userId}/
└── documents/
    └── {userId}/
```

## Security Features
- File type validation
- Size restrictions
- Virus scanning
- Signed URLs for access control
- Encrypted storage (AES256)
- User-based folder isolation

## Definition of Done
- [ ] S3 bucket configured with proper permissions
- [ ] File upload API endpoints implemented
- [ ] Image processing and optimization working
- [ ] File validation and security measures active
- [ ] CDN integration for fast delivery
- [ ] Queue-based file processing implemented
- [ ] File cleanup and management features
- [ ] Access control with signed URLs
- [ ] All tests passing with file upload scenarios
- [ ] Documentation with usage examples
- [ ] Production deployment with monitoring

## Estimated Time
**Beginner Developer**: 6-8 days
**Intermediate Developer**: 4-5 days
**Senior Developer**: 3-4 days

## Required Skills
- AWS S3 and CloudFront configuration
- File upload and processing in Node.js
- Image optimization techniques
- Security best practices for file handling
- Stream processing for large files
- Database file metadata management
- Error handling and validation

## Related Issues
- CP-009: Background Job Processing and Queues
- CP-046: CSV File Import and Parsing
- CP-047: Exchange Export File Processing
- CP-048: Portfolio Data Export Features