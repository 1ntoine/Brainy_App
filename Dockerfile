FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY apps/web/package.json apps/web/
RUN npm install && npm install --workspace apps/web
COPY . .
RUN npm run build --workspace apps/web
EXPOSE 4000 4001 4002 4003 4004 5173
CMD ["npm", "run", "start:backend"]
