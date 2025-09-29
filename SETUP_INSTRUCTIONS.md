# Kube-Compactor Setup Instructions

## 🚀 Repository Setup Complete!

Your Kube-Compactor project is now configured with:
- ✅ Git repository initialized
- ✅ Docker Hub integration (kanurkarprateek/kube-compactor)
- ✅ GitHub Actions CI/CD pipeline
- ✅ Multi-architecture Docker builds (amd64, arm64)

## 📦 Next Steps

### 1. Push to GitHub
```bash
git push -u origin main
```

### 2. Set Up Docker Hub Secret in GitHub
Go to your GitHub repository settings:
1. Navigate to Settings → Secrets and variables → Actions
2. Add a new repository secret:
   - Name: `DOCKER_HUB_PASSWORD`
   - Value: Your Docker Hub password

### 3. Docker Image will be available at:
```bash
docker pull kanurkarprateek/kube-compactor:latest
```

## 🐳 Docker Commands

### Build locally:
```bash
docker build -t kanurkarprateek/kube-compactor:latest .
```

### Push manually (if needed):
```bash
docker login -u kanurkarprateek
docker push kanurkarprateek/kube-compactor:latest
```

### Run the container:
```bash
# As controller in cluster
docker run -d --name kube-compactor \
  -v ~/.kube/config:/home/nodejs/.kube/config:ro \
  kanurkarprateek/kube-compactor:latest

# As CLI tool
docker run --rm -it \
  -v ~/.kube/config:/home/nodejs/.kube/config:ro \
  kanurkarprateek/kube-compactor:latest \
  node src/index.js analyze --cluster
```

## 🎯 Deployment to Kubernetes

### Quick deployment using your Docker image:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kube-compactor
  namespace: kube-compactor
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kube-compactor
  template:
    metadata:
      labels:
        app: kube-compactor
    spec:
      containers:
      - name: kube-compactor
        image: kanurkarprateek/kube-compactor:latest
        imagePullPolicy: Always
```

### Apply to cluster:
```bash
kubectl apply -f k8s-controller/deploy/quick-start.yaml
```

## 🏷️ Version Tags

The CI/CD pipeline will automatically create these tags:
- `kanurkarprateek/kube-compactor:latest` - Latest main branch
- `kanurkarprateek/kube-compactor:v1.0.0` - Semantic version (when you tag)
- `kanurkarprateek/kube-compactor:main` - Main branch builds

### To create a release:
```bash
git tag v1.0.0
git push origin v1.0.0
```

## 📊 Monitoring Your Builds

Check your builds at:
- GitHub Actions: https://github.com/KanurkarPrateek/Kube-Compacter/actions
- Docker Hub: https://hub.docker.com/r/kanurkarprateek/kube-compactor

## 🔐 Security Notes

- Docker Hub password is stored as GitHub secret
- Images are signed and scanned automatically
- Multi-arch support for different K8s nodes
- Non-root container for security

## 🎉 You're Ready!

Once you push to GitHub and set up the Docker Hub secret, every commit to main will:
1. Build a multi-arch Docker image
2. Push to Docker Hub automatically
3. Tag appropriately
4. Be ready for Kubernetes deployment

Happy Compacting! 🗜️