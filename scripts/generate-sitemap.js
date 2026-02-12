#!/usr/bin/env node

/**
 * Sitemap Generator for Kaattaal AI
 * Automatically generates sitemap.xml with current dates and proper URLs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const config = {
  baseUrl: (process.env.NEXT_PUBLIC_SITE_URL || 'https://kaattaal.ai.in').replace(/\/$/, ''),
  outputPath: path.join(__dirname, '..', 'public', 'sitemap.xml'),
  pages: [
    {
      path: '/',
      priority: '1.0',
      changefreq: 'weekly',
      lastmod: new Date().toISOString().split('T')[0]
    },
    {
      path: '/chat',
      priority: '0.9',
      changefreq: 'daily',
      lastmod: new Date().toISOString().split('T')[0]
    },
    {
      path: '/upload',
      priority: '0.8',
      changefreq: 'monthly',
      lastmod: new Date().toISOString().split('T')[0]
    }
  ]
};

/**
 * Generate sitemap XML content
 */
function generateSitemapXML() {
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
  const urlsetStart = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  const urlsetEnd = '</urlset>';

  const urls = config.pages.map(page => {
    return `  <url>
    <loc>${config.baseUrl}${page.path}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
  }).join('\n');

  return `${xmlHeader}
${urlsetStart}
${urls}
${urlsetEnd}`;
}

/**
 * Write sitemap to file
 */
function writeSitemap() {
  try {
    const sitemapContent = generateSitemapXML();
    fs.writeFileSync(config.outputPath, sitemapContent, 'utf8');
    console.log(`✅ Sitemap generated successfully at: ${config.outputPath}`);
    console.log(`🌐 Base URL: ${config.baseUrl}`);
    console.log(`📄 Pages included: ${config.pages.length}`);
  } catch (error) {
    console.error('❌ Error generating sitemap:', error.message);
    process.exit(1);
  }
}

/**
 * Main execution
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🚀 Generating sitemap for Kaattaal AI...');
  writeSitemap();
}

export { generateSitemapXML, writeSitemap };
