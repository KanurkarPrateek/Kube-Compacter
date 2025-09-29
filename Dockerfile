FROM node:18-alpine

# Install kubectl
RUN apk add --no-cache curl && \
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && \
    chmod +x kubectl && \
    mv kubectl /usr/local/bin/

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src
COPY k8s-controller ./k8s-controller

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Expose metrics port
EXPOSE 8080

# Default to controller mode, can be overridden
CMD ["node", "k8s-controller/src/controller.js"]

# Alternative: CLI mode
# CMD ["node", "src/index.js", "analyze", "--cluster"]