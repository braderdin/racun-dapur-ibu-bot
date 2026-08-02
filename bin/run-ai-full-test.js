#!/usr/bin/env node

/**
 * AI Full Test CLI Script
 * CLI runner script for Chip Besar to execute 1-click end-to-end dry-run testing
 * (Lazada Fetch -> AI Image Rank -> RAG Copy -> Social Post -> Comment -> Telegram Audit)
 */

const { spawn } = require('child_process')
const { readFileSync } = require('fs')
const { join } = require('path')

class AIFullTestRunner {
  constructor(options) {
    this.options = options
    this.testResults = []
    this.startTime = Date.now()
  }

  async run() {
    console.log('🚀 Starting AI Full Test Suite')
    console.log(`Mode: ${this.options.mode}`)
    console.log(`Category: ${this.options.category || 'all'}`)
    console.log(`Limit: ${this.options.limit || 'unlimited'}`)
    console.log('')

    try {
      await this.runLazadaFetchTest()
      await this.runAIImageRankTest()
      await this.runRAGCopyTest()
      await this.runSocialPostTest()
      await this.runCommentTest()
      await this.runTelegramAuditTest()

      this.generateReport()
    } catch (error) {
      console.error('❌ Test suite failed:', error)
      process.exit(1)
    }
  }

  async runLazadaFetchTest() {
    console.log('📦 Step 1: Lazada Fetch Test')
    console.log('Fetching products from Lazada API...')

    const testScript = join(process.cwd(), 'bin', 'run-live-lazada-test.js')
    const result = await this.runNodeScript(testScript, {
      mode: 'dry-run',
      category: this.options.category,
      limit: this.options.limit,
    })

    this.testResults.push({
      step: 'Lazada Fetch',
      status: 'completed',
      duration: result.duration,
      data: result.data,
    })

    console.log(`✅ Lazada Fetch Test completed in ${result.duration}ms`) 
    console.log('')
  }

  async runAIImageRankTest() {
    console.log('🖼️ Step 2: AI Image Rank Test')
    console.log('Testing AI image ranking service...')

    const testCode = `
const { AIImageRanker } = require('./src/services/ai-image-ranker');

async function testImageRanker() {
  const ranker = new AIImageRanker();
  
  const testPayload = {
    productId: 'test-product-001',
    images: [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
      'https://example.com/image3.jpg'
    ],
    category: 'kitchen',
    price: 99.99,
    discount: 25,
    stock: 50,
    rating: 4.5,
  };

  try {
    const rankedImage = await ranker.rankProductImages(testPayload);
    console.log('Image ranking successful:', rankedImage.ctrScore.toFixed(2));
    return { success: true, ctrScore: rankedImage.ctrScore };
  } catch (error) {
    console.error('Image ranking failed:', error.message);
    return { success: false, error: error.message };
  }
}

testImageRanker();
`;

    const result = await this.runNodeCode(testCode, 'test-image-ranker')

    this.testResults.push({
      step: 'AI Image Rank',
      status: result.success ? 'completed' : 'failed',
      duration: result.duration,
      data: result.data,
    })

    if (result.success) {
      console.log(`✅ AI Image Rank Test completed in ${result.duration}ms`) 
    } else {
      console.log(`❌ AI Image Rank Test failed: ${result.error}`)
    }
    console.log('')
  }

  async runRAGCopyTest() {
    console.log('✍️ Step 3: RAG Copy Test')
    console.log('Testing Vector RAG copywriting service...')

    const testCode = `
const { VectorRAGCopywriter } = require('./src/services/vector-rag-copywriter');

async function testRAGCopywriter() {
  const copywriter = new VectorRAGCopywriter();
  
  const testProductInfo = {
    category: 'kitchen',
    productType: 'blender',
    priceRange: 'affordable',
    season: 'all',
  };

  try {
    const generatedCopy = await copywriter.generateCopyWithRAG(
      testProductInfo,
      'x'
    );
    console.log('RAG copywriting successful:', generatedCopy.hook.substring(0, 50) + '...');
    return { success: true, copy: generatedCopy };
  } catch (error) {
    console.error('RAG copywriting failed:', error.message);
    return { success: false, error: error.message };
  }
}

testRAGCopywriter();
`;

    const result = await this.runNodeCode(testCode, 'test-rag-copywriter')

    this.testResults.push({
      step: 'RAG Copy',
      status: result.success ? 'completed' : 'failed',
      duration: result.duration,
      data: result.data,
    })

    if (result.success) {
      console.log(`✅ RAG Copy Test completed in ${result.duration}ms`) 
    } else {
      console.log(`❌ RAG Copy Test failed: ${result.error}`)
    }
    console.log('')
  }

  async runSocialPostTest() {
    console.log('📱 Step 4: Social Post Test')
    console.log('Testing social payload builder...')

    const testCode = `
const { SocialPayloadBuilder } = require('./src/services/social-payload-builder');

async function testSocialPayloadBuilder() {
  const builder = new SocialPayloadBuilder();
  
  const testContent = {
    text: 'Test social media content for AI Full Test',
    media: {
      url: 'https://example.com/test-image.webp',
      type: 'image',
      alt: 'Test image'
    },
    affiliateLink: 'https://racun.ibu.my/r/test',
    cta: 'Get yours now!',
    metadata: { test: true }
  };

  const scheduling = {
    delay: 3,
    scheduledAt: Date.now() + 3000,
  };

  try {
    const payload = await builder.buildPayload('x', 'main', testContent, scheduling);
    console.log('Social payload builder successful:', payload.validation.isValid ? 'Valid' : 'Invalid');
    return { success: true, payload };
  } catch (error) {
    console.error('Social payload builder failed:', error.message);
    return { success: false, error: error.message };
  }
}

testSocialPayloadBuilder();
`;

    const result = await this.runNodeCode(testCode, 'test-social-payload-builder')

    this.testResults.push({
      step: 'Social Post',
      status: result.success ? 'completed' : 'failed',
      duration: result.duration,
      data: result.data,
    })

    if (result.success) {
      console.log(`✅ Social Post Test completed in ${result.duration}ms`) 
    } else {
      console.log(`❌ Social Post Test failed: ${result.error}`)
    }
    console.log('')
  }

  async runCommentTest() {
    console.log('💬 Step 5: Comment Test')
    console.log('Testing smart comment scheduler...')

    const testCode = `
const { SmartCommentScheduler } = require('./src/services/smart-comment-scheduler');

async function testCommentScheduler() {
  const scheduler = new SmartCommentScheduler();
  
  const testContent = {
    text: 'Test comment for AI Full Test',
    affiliateLink: 'https://racun.ibu.my/r/test-comment',
    metadata: { test: true }
  };

  try {
    const schedule = await scheduler.scheduleComment('x', 'test-post-id', 'reply', testContent);
    console.log('Comment scheduler successful:', schedule.id);
    return { success: true, schedule };
  } catch (error) {
    console.error('Comment scheduler failed:', error.message);
    return { success: false, error: error.message };
  }
}

testCommentScheduler();
`;

    const result = await this.runNodeCode(testCode, 'test-comment-scheduler')

    this.testResults.push({
      step: 'Comment',
      status: result.success ? 'completed' : 'failed',
      duration: result.duration,
      data: result.data,
    })

    if (result.success) {
      console.log(`✅ Comment Test completed in ${result.duration}ms`) 
    } else {
      console.log(`❌ Comment Test failed: ${result.error}`)
    }
    console.log('')
  }

  async runTelegramAuditTest() {
    console.log('📊 Step 6: Telegram Audit Test')
    console.log('Testing Telegram audit handler...')

    const testCode = `
const { TelegramAuditHandler } = require('./src/routes/telegram-audit-handler');

async function testTelegramAuditHandler() {
  const handler = new TelegramAuditHandler();
  
  const testAuditData = {
    imagePreview: {
      url: 'https://example.com/test-audit-image.webp',
      type: 'webp',
      width: 800,
      height: 600,
      fileSize: 150000,
    },
    platformInfo: {
      x: {
        mainPost: {
          url: 'https://x.com/test/status',
          text: 'Test X post',
          status: 'published',
          publishedAt: Date.now(),
        },
        reply: {
          url: 'https://x.com/test/status/reply',
          text: 'Test X reply',
          status: 'published',
          publishedAt: Date.now(),
        },
      },
      facebook: {
        mainPost: {
          url: 'https://facebook.com/test/posts',
          text: 'Test Facebook post',
          status: 'published',
          publishedAt: Date.now(),
        },
        comment: {
          url: 'https://facebook.com/test/posts/comments',
          text: 'Test Facebook comment',
          status: 'published',
          publishedAt: Date.now(),
        },
      },
    },
    affiliateLinks: {
      xReply: 'https://racun.ibu.my/r/x_reply_test',
      fbComment: 'https://racun.ibu.my/r/fb_comment_test',
    },
  };

  try {
    const auditMessage = await handler.createVisualAuditMessage(testAuditData);
    console.log('Telegram audit handler successful:', auditMessage.id);
    return { success: true, auditMessage };
  } catch (error) {
    console.error('Telegram audit handler failed:', error.message);
    return { success: false, error: error.message };
  }
}

testTelegramAuditHandler();
`;

    const result = await this.runNodeCode(testCode, 'test-telegram-audit-handler')

    this.testResults.push({
      step: 'Telegram Audit',
      status: result.success ? 'completed' : 'failed',
      duration: result.duration,
      data: result.data,
    })

    if (result.success) {
      console.log(`✅ Telegram Audit Test completed in ${result.duration}ms`) 
    } else {
      console.log(`❌ Telegram Audit Test failed: ${result.error}`)
    }
    console.log('')
  }

  async runNodeScript(scriptPath, args) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()
      
      const child = spawn('node', [scriptPath], {
        stdio: 'pipe',
        env: { ...process.env, NODE_OPTIONS: '--experimental-modules' }
      })

      let output = ''
      let error = ''

      child.stdout?.on('data', (data) => {
        output += data.toString()
      })

      child.stderr?.on('data', (data) => {
        error += data.toString()
      })

      child.on('close', (code) => {
        const duration = Date.now() - startTime
        
        try {
          const result = JSON.parse(output.trim()) || {}
          resolve({
            success: code === 0,
            duration,
            data: result,
            error: error || null,
          })
        } catch (parseError) {
          resolve({
            success: code === 0,
            duration,
            data: output,
            error: error || parseError.message,
          })
        }
      })

      child.on('error', (err) => {
        const duration = Date.now() - startTime
        reject({
          success: false,
          duration,
          error: err.message,
        })
      })
    })
  }

  async runNodeCode(code, description) {
    const tempFile = join(process.cwd(), 'tmp', `${description}.js`)
    
    try {
      const fs = await import('fs/promises')
      await fs.mkdir(join(process.cwd(), 'tmp'), { recursive: true })
      await fs.writeFile(tempFile, code)

      const result = await this.runNodeScript(tempFile, {})
      return result
    } catch (error) {
      return {
        success: false,
        duration: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    } finally {
      try {
        await fs.unlink(tempFile)
      } catch (unlinkError) {
        // Ignore cleanup errors
      }
    }
  }

  generateReport() {
    const totalDuration = Date.now() - this.startTime
    const completedSteps = this.testResults.filter(r => r.status === 'completed').length
    const failedSteps = this.testResults.filter(r => r.status === 'failed').length

    console.log('📋 AI Full Test Report')
    console.log('='.repeat(50))
    console.log(`Total Duration: ${totalDuration}ms`) 
    console.log(`Completed Steps: ${completedSteps}`)
    console.log(`Failed Steps: ${failedSteps}`)
    console.log(`Success Rate: ${((completedSteps / this.testResults.length) * 100).toFixed(1)}%`) 
    console.log('')

    console.log('Step Details:')
    this.testResults.forEach((result, index) => {
      const icon = result.status === 'completed' ? '✅' : '❌'
      console.log(`${icon} Step ${index + 1}: ${result.step} (${result.duration}ms)`)
    })

    console.log('')
    if (failedSteps > 0) {
      console.log('⚠️  Some tests failed. Check the output above for details.')
      process.exit(1)
    } else {
      console.log('🎉 All tests passed successfully!')
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2)
  
  const options = {
    mode: args.includes('--live') ? 'live' : 'dry-run',
    category: args.includes('--category') ? args[args.indexOf('--category') + 1] : undefined,
    limit: args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : undefined,
    verbose: args.includes('--verbose'),
    skip: [],
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node bin/run-ai-full-test.js [options]')
    console.log('')
    console.log('Options:')
    console.log('  --live              Run in live mode (default: dry-run)')
    console.log('  --category <cat>     Category: kitchen, baby, skincare')
    console.log('  --limit <num>        Number of products to test')
    console.log('  --verbose            Enable verbose output')
    console.log('  --help, -h           Show this help message')
    console.log('')
    console.log('Examples:')
    console.log('  node bin/run-ai-full-test.js --category kitchen --limit 5')
    console.log('  node bin/run-ai-full-test.js --live --verbose')
    process.exit(0)
  }

  const runner = new AIFullTestRunner(options)
  await runner.run()
}

if (require.main === module) {
  main().catch(console.error)
}

module.exports = { AIFullTestRunner }