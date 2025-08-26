# Chatbot Application - Docker Images for Review

This package contains Docker images for our chatbot application that supports both local AI models (via Ollama) and cloud-based AI models (via OpenAI API). The application features intelligent auto-configuration that automatically detects and connects to your local setup.

## ⚠️ Prerequisites

Before starting, you need Docker installed on your system:

### Install Docker

**Mac:**
1. Download Docker Desktop from: https://docs.docker.com/desktop/install/mac/
2. Install and start Docker Desktop
3. Verify: `docker --version` in Terminal

**Windows:**
1. Download Docker Desktop from: https://docs.docker.com/desktop/install/windows/
2. Install and start Docker Desktop  
3. Verify: `docker --version` in Command Prompt/PowerShell

**Linux (Ubuntu/Debian):**
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add your user to docker group (optional, avoids sudo)
sudo usermod -aG docker $USER
# Log out and back in, then verify:
docker --version
```

**Other Linux distributions:** See https://docs.docker.com/engine/install/

## 📥 Download and Extract Files

1. **Download from OSF:** 

Download the zip file - chatbot_osf to your computer. It will contain the following files:
   - `chatbot_arm64.tar.gz` (for Apple M1/M2)
   - `chatbot_amd64.tar.gz` (for Intel/AMD)
   - `docker-compose.yml`
   - `README.md`

2. **Move to the directory:** 
   ```bash
   cd chatbot_osf
   ```

3. **Verify files:** Check that you have the files:
   ```bash
   ls -la
   # Should show: chatbot_arm64.tar.gz, chatbot_amd64.tar.gz, docker-compose.yml, README.md
   ```

## 🚀 Quick Start (5 minutes)

*Make sure you've completed the Prerequisites and Download steps above first!*

### Step 0: Verify Docker is Running

```bash
# Test that Docker is working
docker --version
docker run --rm hello-world
```

If the hello-world test works, you're ready to proceed!

### Step 1: Load Docker Image

Choose the appropriate image for your system:

**Apple Silicon (M-series Macs):**
```bash
gunzip -c chatbot_arm64.tar.gz | docker load
```

**Intel Macs / Windows / Linux:**
```bash
gunzip -c chatbot_amd64.tar.gz | docker load
```

You should see a confirmation like:
```
Loaded image: chatbot:arm64
```

### Step 1b: Tag for Docker Compose (Optional)

If you want to use Docker Compose, retag the image:

```bash
# If you loaded ARM64
docker tag chatbot:arm64 chatbot:osf

# If you loaded AMD64  
docker tag chatbot:amd64 chatbot:osf
```

Verify the image is ready:
```bash
docker images | grep chatbot
```

### Step 2: Run the Application

You have two options:

#### Option A: Using Docker Compose

If you tagged the image as `chatbot:osf`:
```bash
docker compose up
```

To run in background:
```bash
docker compose up -d

# Later, to stop:
docker compose down
```

#### Option B: Using Docker Run Directly

**Mac/Windows (Docker Desktop):**
```bash
# Apple M1/M2
docker run --rm -p 3000:3000 --add-host host.docker.internal:host-gateway chatbot:arm64

# Intel/AMD
docker run --rm -p 3000:3000 --add-host host.docker.internal:host-gateway chatbot:amd64
```

**Linux:**
```bash
# Apple M1/M2 (if on ARM Linux)
docker run --rm -p 3000:3000 --add-host host.docker.internal:172.17.0.1 chatbot:arm64

# Intel/AMD
docker run --rm -p 3000:3000 --add-host host.docker.internal:172.17.0.1 chatbot:amd64

# Alternative for Linux (host networking)
docker run --rm --network=host chatbot:amd64
```

### Step 3: Access the Application

Open your browser to: **http://localhost:3000**

You'll see a settings panel where you can configure your AI backend.

## 🎯 Configuration Options

The application supports two AI backends:

### Option A: Local AI with Ollama (Recommended for Privacy)

**Advantages:**
- Complete privacy (everything runs on your machine)
- Works offline after initial setup
- No API costs
- Full control over your data

**Setup:**

1. **Install Ollama** (if not already installed):
   - Visit: https://ollama.com/download
   - Download and install for your operating system
   - Follow the installation instructions

2. **Start Ollama service:**
   ```bash
   ollama serve
   ```
   Keep this running in a terminal window.

3. **Install the AI model:**
   ```bash
   ollama pull llama3.1
   ```
   This downloads the Llama 3.1 model (~4-8GB). This is a one-time download.

4. **Configure the application:**
   - In the chatbot web interface, click "Show Settings"
   - Select "Ollama" 
   - Click "Save Configuration"
   - **The app will automatically detect and connect to your Ollama installation!** ✨

### Option B: Cloud AI with OpenAI API

**Advantages:**
- No local setup required
- Fast responses
- GPT-4o model
- Works on any hardware

**Setup:**

1. **Get an OpenAI API key:**
   - Visit: https://platform.openai.com/api-keys
   - Sign up or log in to your OpenAI account
   - Click "Create new secret key"
   - Copy the key (starts with `sk-`)

2. **Configure the application:**
   - In the chatbot web interface, click "Show Settings"
   - Select "API Key"
   - Paste your OpenAI API key
   - Click "Test API Key" to verify it works
   - Click "Save Configuration"

## 📋 System Requirements

### Minimum Requirements
- **Docker:** Version 20.10 or higher
- **RAM:** 4GB available memory
- **Disk Space:** 500MB for Docker image
- **Operating System:** Mac, Windows, or Linux

### Additional Requirements for Ollama
- **Extra Disk Space:** 4-8GB for AI model download
- **CPU:** Modern multi-core processor (better performance with more cores)
- **RAM:** 8GB+ recommended for smooth operation

### Network Requirements
- **Ollama Mode:** No internet required after setup
- **OpenAI Mode:** Active internet connection required

**Ready to start?** Load the Docker image, run the container, and open http://localhost:3000 in your browser!