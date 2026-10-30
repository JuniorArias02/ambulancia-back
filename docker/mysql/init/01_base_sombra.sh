#!/bin/bash
# Base de datos auxiliar que Prisma Migrate usa para detectar cambios en desarrollo.
set -e
mysql -u root -p"${MYSQL_ROOT_PASSWORD}" <<SQL
CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}_sombra\`;
GRANT ALL PRIVILEGES ON \`${MYSQL_DATABASE}_sombra\`.* TO '${MYSQL_USER}'@'%';
FLUSH PRIVILEGES;
SQL
