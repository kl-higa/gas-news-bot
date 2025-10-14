FROM node:18-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy built files (make sure to run 'npm run build' before docker build)
COPY dist ./dist

# Expose port
EXPOSE 8080

# Start the server
CMD ["node", "dist/index.js"]
