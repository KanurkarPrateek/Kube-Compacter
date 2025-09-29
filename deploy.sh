#!/bin/bash

# Kube-Compactor Deployment Script
# This script builds and pushes the Docker image to Docker Hub

set -e

DOCKER_USERNAME="kanurkarprateek"
IMAGE_NAME="kube-compactor"
VERSION=${1:-latest}

echo "🗜️ Kube-Compactor Deployment Script"
echo "===================================="

# Build Docker image
echo "📦 Building Docker image..."
docker build -t $DOCKER_USERNAME/$IMAGE_NAME:$VERSION .

if [ $? -eq 0 ]; then
    echo "✅ Docker image built successfully!"
else
    echo "❌ Docker build failed!"
    exit 1
fi

# Login to Docker Hub
echo "🔐 Logging in to Docker Hub..."
echo "Please enter your Docker Hub password when prompted:"
docker login -u $DOCKER_USERNAME

# Push to Docker Hub
echo "📤 Pushing image to Docker Hub..."
docker push $DOCKER_USERNAME/$IMAGE_NAME:$VERSION

if [ $? -eq 0 ]; then
    echo "✅ Image pushed successfully!"
    echo "🎉 Your image is now available at:"
    echo "   docker pull $DOCKER_USERNAME/$IMAGE_NAME:$VERSION"
else
    echo "❌ Push failed!"
    exit 1
fi

# Tag as latest if version specified
if [ "$VERSION" != "latest" ]; then
    docker tag $DOCKER_USERNAME/$IMAGE_NAME:$VERSION $DOCKER_USERNAME/$IMAGE_NAME:latest
    docker push $DOCKER_USERNAME/$IMAGE_NAME:latest
    echo "✅ Also tagged and pushed as 'latest'"
fi

echo ""
echo "🚀 Deployment complete!"
echo ""
echo "To deploy to Kubernetes:"
echo "  kubectl apply -f k8s-controller/deploy/quick-start.yaml"
echo ""
echo "To run locally:"
echo "  docker run -d --name kube-compactor \\"
echo "    -v ~/.kube/config:/home/nodejs/.kube/config:ro \\"
echo "    $DOCKER_USERNAME/$IMAGE_NAME:$VERSION"