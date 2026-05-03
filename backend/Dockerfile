# Use a lightweight Node image
FROM node:20-alpine

# Create a place for the app to live
WORKDIR /app

# Create a fake project file so it doesn't crash
RUN npm init -y

# Tell Docker this container stays open
CMD ["node", "index.js"]