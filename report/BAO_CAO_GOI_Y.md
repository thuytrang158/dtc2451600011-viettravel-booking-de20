# GỢI Ý BÁO CÁO TỐI THIỂU 10 TRANG – ĐỀ 20

Không coi đây là kết quả thực tế; phải chạy thử và chèn ảnh chụp của chính bạn.

1. Trang bìa: trường, khoa, môn, Đề 20, tên và MSSV, giảng viên.
2. Trang mục lục, mục tiêu đề tài, các chức năng tour/lịch trình/khách hàng.
3. Phân tích kiến trúc Docker Compose và sơ đồ 3 mạng app_net, db_net, monitor_net.
4. Thiết kế database PostgreSQL: bảng tours, itineraries, customers, bookings, quan hệ khóa ngoại.
5. Demo giao diện trang chủ, chi tiết tour, đặt tour và trang quản trị booking.
6. Demo pgAdmin: kết nối database, mở bảng, tối thiểu 3 câu SQL SELECT / JOIN / GROUP BY.
7. Nginx reverse proxy: cổng 8088 -> HTTPS 8443, security headers; chụp lệnh curl -kI.
8. Prometheus: Targets (nếu truy cập qua SSH tunnel); số liệu Node, PostgreSQL, Nginx, cAdvisor.
9. Grafana: Data sources Prometheus, Loki và dashboard VietTravel.
10. Log tập trung: Loki + Promtail, ba câu LogQL và ảnh phản hồi sau khi tạo traffic.
11. Hardening: app user node không root; DB không mở port; mạng db_net internal;
    mật khẩu ngẫu nhiên .env / .gitignore; HTTPS tự ký; headers; rate limiting; DB user hạn chế quyền.
12. GitHub: tên repository, 3 commit có ý nghĩa, README, ảnh git log.
13. Kết quả, lỗi và cách khắc phục, hạn chế hệ thống, hướng phát triển.

Checklist ảnh nên thu thập:
- `sudo docker compose ps` thấy 11 dịch vụ Up.
- Website / Tour / Đặt tour / Mã booking / Admin đổi trạng thái.
- pgAdmin 4 bảng, câu SQL trên Postgres.
- nginx security headers, redirect 301 / HTTPS tự ký.
- Prometheus job `up` và dashboard Grafana.
- Grafana Explore / Loki: 3 LogQL có kết quả.
- Terminal hardening: docker compose exec web id, docker compose ps, postgres không public port.
- GitHub commits / README.

Lưu ý: khi chụp màn hình để đưa vào báo cáo, che mật khẩu và không chụp nội dung .env.
