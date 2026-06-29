FROM image.x-humanoid-cloud.com/infra/nginx:1.0

ENV TZ Asia/Shanghai

ADD dist/web /var/www/

COPY nginx.conf /etc/nginx/conf.d/

CMD nginx -g 'daemon off;'
