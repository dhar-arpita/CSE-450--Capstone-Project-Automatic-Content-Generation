# This will work flawlessly
FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json ./
#RUN npm ci
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]