# VietTravel – Booking Tour Du lịch (Đề 20)

Dự án mẫu thực hành môn **Triển khai và Quản trị Hệ thống Phần mềm**:
- Web Node.js/Express: xem tour, lịch trình từng ngày, đặt tour, quản trị booking và tour (CRUD).
- PostgreSQL 16 + pgAdmin.
- Nginx reverse proxy, HTTPS chứng chỉ tự ký và security headers.
- Prometheus + Grafana (Node.js, Nginx, PostgreSQL, container với cAdvisor).
- Loki + Promtail (log Nginx access và error) + LogQL.
- Hardening: tài khoản DB hạn chế quyền, tách Docker network, web `USER node`, HTTPS, rate limiting, .env không commit, mật khẩu ngẫu nhiên.

**Lưu ý:** Đây là mô hình thí nghiệm trên mạng riêng của VM, không phải cấu hình sản xuất. Promtail hết hỗ trợ từ 2026, chỉ giữ để đáp ứng đề bài; ở production dùng Grafana Alloy, chuyển Ubuntu 18.04 sang OS được hỗ trợ và dùng TLS hợp lệ.

## A. Điều kiện

Máy ảo Ubuntu có Docker Engine, Docker Compose v2, unzip, openssl, curl. Khuyên dùng ít nhất 4–6 GB RAM, 20 GB đĩa trống, Internet tải Docker images. Trên Ubuntu 18.04, bản Docker/Compose cũ có thể phát sinh lỗi tương thích.

```bash
sudo docker --version
sudo docker compose version
free -h
df -h
```

## B. Cài chạy

Tải ZIP từ ChatGPT trên Windows, sau đó trong PowerShell **Windows**, không phải SSH:

```powershell
scp "$env:USERPROFILE\Downloads\viettravel-docker.zip" nguyentrang@192.168.126.128:~/
```

Trở lại cửa sổ SSH Ubuntu:

```bash
cd ~
python3 -m zipfile -e viettravel-docker.zip .
cd ~/viettravel-docker
bash scripts/init-env.sh
sudo docker compose config --quiet
sudo docker compose up -d --build
sudo docker compose ps
```

Nếu tải bằng trình duyệt sang thư mục khác ngoài Downloads, sửa đường dẫn Windows trong câu `scp`.

**Mật khẩu:** `cat .env` chỉ khi cần đọc ở máy riêng, tuyệt đối không đăng GitHub hoặc chụp gửi công khai. Script giữ nguyên .env đã có; nếu `.env` thay đổi sau khi database đã khởi tạo thì mật khẩu trong DB không tự đổi theo.

## C. Truy cập từ Windows

Giả sử IP máy ảo là `192.168.126.128`:

| Dịch vụ | URL | Đăng nhập |
| --- | --- | --- |
| Website | https://192.168.126.128:8443 | công khai |
| HTTP redirect | http://192.168.126.128:8088 | chuyển sang HTTPS |
| Quản trị tour | https://192.168.126.128:8443/admin.html | `ADMIN_USER` / `ADMIN_PASSWORD` trong `.env` |
| pgAdmin | http://192.168.126.128:5050 | `PGADMIN_EMAIL` / `PGADMIN_PASSWORD` trong `.env` |
| Grafana | http://192.168.126.128:3005 | `GRAFANA_USER` / `GRAFANA_PASSWORD` trong `.env` |
| Prometheus | http://182.168.126.128:9095 (trên Ubuntu, hoặc SSH tunnel) | không có mật khẩu, cố ý chỉ bind localhost |

Website sử dụng chứng chỉ tự ký nên trình duyệt cảnh báo. Trong bài lab, có thể chọn Advanced → Proceed. Không làm điều này với trang công cộng không tin cậy.

pgAdmin → Register → Server:
- Name: `VietTravel PostgreSQL`
- Connection/Host: `postgres`
- Port: `5432`
- Maintenance database: `travel_db`
- Username: `postgres`
- Password: giá trị `POSTGRES_PASSWORD` trong file `.env`.

Lưu ý: **Không gõ địa chỉ IP của máy ảo vào trường Host của pgAdmin**: pgAdmin và DB ở cùng mạng Docker; tên service `postgres` mới đúng.

## D. Demo chức năng

1. Vào website → xem 6 tour được lưu trong DB.
2. Nhấn Chi tiết một tour → thấy lịch trình từng ngày.
3. Điền tên, email, điện thoại, ngày khởi hành (hôm nay trở đi), số khách → Đặt tour.
4. Ghi lại mã booking sau khi nhận phản hồi.
5. Vào `/admin.html`, đăng nhập, xem booking → đổi trạng thái `pending` thành `confirmed`.
6. Trong quản trị tạo tour, sửa, xóa tour chưa có booking. Tour đã có booking bị từ chối xóa để giữ toàn vẹn dữ liệu.
7. Mở pgAdmin → Query Tool → chạy các câu SQL:

```sql
SELECT id, title, destination, price FROM tours ORDER BY id;
SELECT b.id, c.full_name, t.title, b.departure_date, b.guests, b.status
FROM bookings b JOIN customers c ON c.id=b.customer_id
JOIN tours t ON t.id=b.tour_id ORDER BY b.id DESC;
SELECT t.title, COUNT(b.id) AS so_booking, COALESCE(SUM(b.guests),0) AS so_khach
FROM tours t LEFT JOIN bookings b ON b.tour_id=t.id
GROUP BY t.id ORDER BY so_booking DESC;
```

## E. Grafana / Prometheus

Grafana → Dashboards → VietTravel → `VietTravel | Web - Nginx - PostgreSQL - Containers`.
Nếu chưa thấy, kiểm tra log:

```bash
sudo docker compose logs --tail=100 grafana prometheus postgres_exporter nginx_exporter cadvisor
```

Grafana → Explore → Data source `Prometheus`; chạy lần lượt:

```promql
up
pg_up
nginx_http_requests_total
rate(http_requests_total[2m])
container_memory_working_set_bytes
```

`up=1` là target được scrape thành công, không phải toàn bộ website chắc chắn xử lý booking thành công.

Muốn xem giao diện **Targets** của Prometheus trên Windows, mở một cửa sổ PowerShell Windows *mới*:

```powershell
ssh -N -L 9095:127.0.0.1:9095 nguyentrang@192.168.126.128
```

Để nguyên cửa sổ đó mở; truy cập http://127.0.0.1:9095/targets trên Chrome Windows. Đóng cửa sổ này thì ngắt SSH tunnel.

## F. Loki + LogQL

Vào website một vài lần, mở chi tiết tour, đặt thử, và truy cập một URL không có thật.
Grafana → Explore → Data source `Loki` → chế độ `Code` → chọn `Last 30 minutes` → chạy:

```logql
{job="nginx_access"}
{job="nginx_access"} |= "GET /api/tours"
{job="nginx_access"} |= "POST /api/bookings"
{job="nginx_access"} |= "404"
```

Đôi khi Loki / Promtail cần một lúc để nạp log. Kiểm tra:

```bash
sudo docker compose logs --tail=100 loki promtail nginx
sudo docker compose exec nginx sh -c 'tail -n 10 /var/log/nginx/access.log'
```

## G. Kiểm tra hardening

```bash
sudo docker compose exec web id
sudo docker compose ps
curl -k -I https://127.0.0.1:8443/
sudo docker compose exec postgres psql -U postgres -d travel_db -c '\du'
sudo docker compose exec web sh -c 'id; ls -ld /app'
```

- `web` chạy người dùng `node` không phải `root`.
- Không có `ports:` của Postgres và web: không mở cổng DB và Node.js trực tiếp trên VM.
- `db_net` là mạng Docker `internal: true`, chỉ service có quyền tham gia mới nhìn thấy DB.
- Có HTTPS self-signed + X-Frame-Options + X-Content-Type-Options + CSP.
- User `travel_app` không có quyền superuser; exporter đọc monitoring với `pg_monitor`.
- `ADMIN_PASSWORD`, mật khẩu Postgres... giữ trong `.env`, file nằm trong `.gitignore`.
- Trang đặt booking giới hạn 12 lần / 15 phút / IP thông qua express-rate-limit.

## H. GitHub: ít nhất ba commit có ý nghĩa

Tạo repo **public/private tùy giảng viên**, tên có MSSV, ví dụ `MSSV-viettravel-booking-de20`.
Trên Ubuntu:

```bash
git init
git branch -M main
git config user.name "Ten Cua Ban"
git config user.email "email-github@example.com"
# Commit 1: source website, database, nginx, cấu hình Compose
git add .gitignore .env.example app/ db/ nginx/ docker-compose.yml scripts/ README.md
git commit -m "feat: booking website with PostgreSQL and Nginx reverse proxy"
# Commit 2: Prometheus / Grafana
git add monitoring/prometheus.yml monitoring/grafana/
git commit -m "feat: add Prometheus Grafana container web and database monitoring"
# Commit 3: Loki / Promtail / hướng dẫn báo cáo
git add monitoring/loki.yml monitoring/promtail.yml report/
git commit -m "feat: centralize Nginx logs with Loki Promtail and LogQL"
git log --oneline -3
git status
```

`git status` phải cho biết working tree sạch và `.env` **không được xuất hiện** trong các file được theo dõi. Sau đó:

```bash
git remote add origin https://github.com/TEN_TAI_KHOAN/TEN_REPO.git
git push -u origin main
```

Cần thay `TEN_TAI_KHOAN` và `TEN_REPO`, dùng GitHub personal access token có quyền ghi vào repo nếu Git hỏi mật khẩu. **Không đưa token vào lệnh, README hay ảnh chụp**.

## I. Dừng, bật lại, xử lý lỗi

```bash
cd ~/viettravel-docker
sudo docker compose stop          # dừng nhưng giữ dữ liệu
sudo docker compose start         # chạy lại sau khi bật VM
sudo docker compose up -d         # khởi động lại nếu container đã bị xóa
sudo docker compose ps
sudo docker compose logs --tail=80 web postgres nginx
```

Nếu IP máy ảo thay đổi, chạy `hostname -I` trên Ubuntu để xem IP mới và sửa URL trên Windows.

**Tránh `sudo docker compose down -v`**, vì lệnh này xóa toàn bộ PostgreSQL, booking, dashboard và dữ liệu lưu trong volume. Nếu DB đã được khởi tạo, không đổi mật khẩu trong `.env` rồi khởi động lại một cách tùy ý.

### Lỗi thường gặp

- Port đã dùng: `sudo ss -lntp | grep -E ':(8088|8443|5050|3005|9095)\b'`; đổi port trong `.env` trước khi chạy lại (nếu đổi HTTPS port, đồng thời sửa URL redirect trong `nginx/default.conf`).
- Web trả `502`: kiểm tra `sudo docker compose logs --tail=100 web postgres`.
- `pgAdmin` kết nối fail: host phải là `postgres`, tên DB là `travel_db`, user `postgres`, password `POSTGRES_PASSWORD`.
- Docker Compose không tồn tại: cài Compose v2; **không cài `docker-compose` v1 cũ** trên Ubuntu 18.04.
- Docker pull lỗi credential helper / D-Bus: kiểm tra `$HOME/.docker/config.json` và `sudo` config; không xóa login Docker của người dùng khác.
- VM yếu: kiểm tra `free -h`, `df -h`, `sudo docker compose logs cadvisor`.
- Loki không có log: xác nhận file `nginx/access.log` có dữ liệu và chạy query trong `Last 30 minutes`.

## J. Nội dung báo cáo

Xem `report/BAO_CAO_GOI_Y.md`. Cần tự chạy, chụp minh chứng thật trước khi nộp.
