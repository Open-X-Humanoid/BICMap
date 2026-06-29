FROM image.x-humanoid-cloud.com/infra/node:22-alpine

ENV TZ Asia/Shanghai

WORKDIR /app

ENV  BUILD_ENV stage

ENV  USER gitlab-runner

RUN npm config set registry https://registry.npmmirror.com -g

RUN npm install -g pnpm

USER $USER

CMD sed -i 's/\r//' /app/pnpm.sh && sh /app/pnpm.sh
