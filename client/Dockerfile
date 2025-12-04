FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code (node_modules excluded via .dockerignore)
COPY . .

# Ensure leaflet is installed
RUN npm list leaflet || npm install leaflet

# Expose port
EXPOSE 5173

# Start dev server
CMD ["npm", "run", "dev", "--", "--host"]
