# Orbioo Engine Dockerfile (V1.5.8)
FROM node:22-alpine

# Install PM2 globally
RUN npm install pm2 -g

# Create app directory
WORKDIR /usr/src/app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source and config
COPY . .

# Build the TypeScript project
RUN npm run build

# Expose ports for the cluster (2567-2570)
EXPOSE 2567 2568 2569 2570

# Use pm2-runtime for Docker environments
# This ensures the container stays alive and logs go to stdout
CMD ["pm2-runtime", "start", "ecosystem.config.cjs"]
