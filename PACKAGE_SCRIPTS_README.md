# Package.json Scripts Guide

## 🚀 **Streamlined Malayalam System Scripts**

### **Core Development**
```bash
npm run dev          # Start development server with Turbopack
npm run build        # Build for production (skips linting for speed)
npm run start        # Start production server
npm run lint         # Run ESLint
```

### **Malayalam Document Processing (Primary)**
```bash
npm run prepare:data         # Recommended: Smart ingestion with Docling-inspired chunking
npm run prepare:data:full    # Full document re-extraction and re-indexing
npm run docs:update          # Lightweight incremental update (for minor changes)
```

### **Maintenance & Advanced Processing**
```bash
npm run reprocess:docs       # Deep reprocess with location-aware settings (uses v2 namespace)
npm run process:malayalam    # Legacy/Direct processing for specific MD folders
npm run docs:update:force    # Force reprocess all documents via incremental logic
```

### **Data Lifecycle**
```bash
npm run delete:index         # Complete Wipe: Delete the entire Pinecone index
npm run clear:data           # Clear current Pinecone namespace (keep the index)
npm run reset:data           # Full Factory Reset: Delete index and re-index from scratch
npm run refill:data          # Clear current namespace and re-extract data
```

### **Validation & Analysis**
```bash
npm run test:malayalam             # Comprehensive system test with RAG validation
npm run analyze:database           # Debug: Analyze database retrieval performance
npm run test:table-serialization   # Verify: Ensure markdown tables are correctly indexed
```

### **SEO & Deployment**
```bash
npm run generate:sitemap     # Generate SEO sitemap
npm run postbuild            # Automated post-build tasks
```

## 🎯 **Recommended Workflow**

### **1. Setup**
```bash
npm run dev
```

### **2. Ingesting Data (First Time)**
```bash
# Prepare and index the documents (Best results)
npm run prepare:data

# Test the retrieval
npm run test:malayalam
```

### **3. Adding New Documents**
```bash
# Add new files to public/docs/pdf-md/ and run:
npm run docs:update
```

### **4. If Retrieval Accuracy is Low (e.g. for hospitals)**
```bash
# Run the specialized location-aware reprocessor
npm run reprocess:docs
```

## 📊 **Optimizations**

- **Direct Pinecone Integration**: Optimized for the Malayalam-specific RAG pipeline.
- **Hierarchical Chunking**: Uses `prepare:data` for superior document understanding.
- **Faster CI**: `SKIP_LINT` enabled in production builds.

---

*This guide reflects only the functional scripts confirmed to be working in the Kaattaal.ai environment.*
