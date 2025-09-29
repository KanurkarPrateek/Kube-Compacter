FROM node:18-alpine

# Install kubectl for CLI operations
RUN apk add --no-cache curl && \
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && \
    chmod +x kubectl && \
    mv kubectl /usr/local/bin/

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY node-resource-optimizer/package*.json ./node-resource-optimizer/

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY node-resource-optimizer/src ./src
COPY node-resource-optimizer/k8s-controller ./k8s-controller

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Health check endpoint
EXPOSE 8080

# Start controller
CMD ["node", "k8s-controller/src/controller.js"]