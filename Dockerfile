# Use an official Node.js runtime as a parent image
FROM node:18

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install any needed dependencies
RUN npm install

# Copy the rest of your application code
COPY . .

# Expose port 3001 to the outside world
EXPOSE 3001

# Command to run your app
CMD ["./wait-for-it.sh", "vyzyvatel-backend-web:8000", "--", "node", "index.js"]
