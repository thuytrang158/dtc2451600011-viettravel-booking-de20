CREATE TABLE tours (
  id SERIAL PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  destination VARCHAR(120) NOT NULL,
  duration_days INTEGER NOT NULL CHECK (duration_days BETWEEN 1 AND 30),
  price INTEGER NOT NULL CHECK (price >= 0),
  capacity INTEGER NOT NULL DEFAULT 20 CHECK (capacity BETWEEN 1 AND 1000),
  description TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE itineraries (
  id SERIAL PRIMARY KEY,
  tour_id INTEGER NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL CHECK (day_number >= 1),
  details TEXT NOT NULL,
  UNIQUE(tour_id, day_number)
);
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(200) NOT NULL UNIQUE,
  phone VARCHAR(24) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  tour_id INTEGER NOT NULL REFERENCES tours(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  departure_date DATE NOT NULL,
  guests INTEGER NOT NULL CHECK (guests BETWEEN 1 AND 20),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_booking_tour_departure ON bookings(tour_id,departure_date);

INSERT INTO tours (title,destination,duration_days,price,capacity,description,image_url) VALUES
('Hà Giang – Mùa đá nở hoa','Hà Giang',4,3290000,20,'Chinh phục Mã Pí Lèng, sông Nho Quế, bản làng giữa cao nguyên đá.','https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=1000&q=85'),
('Sa Pa – Mây và núi','Lào Cai',3,2690000,22,'Dạo bản Cát Cát, ngắm ruộng bậc thang và bình minh giữa biển mây.','https://images.unsplash.com/photo-1500534623283-312aade485b7?w=1000&q=85'),
('Hạ Long – Kỳ quan trên biển','Quảng Ninh',2,2390000,26,'Du thuyền ngắm vịnh, chèo kayak, khám phá hang động.','https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=1000&q=85'),
('Hội An – Dấu ấn phố cổ','Quảng Nam',3,2890000,18,'Lang thang phố đèn lồng, thưởng thức ẩm thực và văn hóa miền Trung.','https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1000&q=85'),
('Phú Quốc – Hẹn với biển xanh','Kiên Giang',4,4590000,24,'Thư giãn trên bãi biển, khám phá đảo và trải nghiệm hoàng hôn.','https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1000&q=85'),
('Thái Nguyên – Về miền xứ trà','Thái Nguyên',2,1590000,20,'Thăm đồi chè Tân Cương, hồ Núi Cốc, trải nghiệm nghệ thuật pha trà.','https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1000&q=85');

INSERT INTO itineraries (tour_id,day_number,details) VALUES
(1,1,'Hà Nội – Hà Giang, tham quan cột mốc và nghỉ tại thành phố.'),(1,2,'Quản Bạ – Yên Minh – Đồng Văn, thăm các bản làng.'),(1,3,'Đèo Mã Pí Lèng, đi thuyền sông Nho Quế.'),(1,4,'Trở về Hà Nội, kết thúc hành trình.'),
(2,1,'Đến Sa Pa, khám phá thị trấn.'),(2,2,'Bản Cát Cát, ruộng bậc thang và núi đồi.'),(2,3,'Tự do mua sắm, trở về.'),
(3,1,'Khởi hành ra vịnh, du thuyền và chèo kayak.'),(3,2,'Thăm hang động, trở về.'),
(4,1,'Di chuyển đến Hội An, dạo phố cổ.'),(4,2,'Làng nghề và ẩm thực địa phương.'),(4,3,'Tham quan buổi sáng và kết thúc.'),
(5,1,'Đến Phú Quốc, nhận phòng nghỉ.'),(5,2,'Lặn ngắm san hô và khám phá biển.'),(5,3,'Tự do trải nghiệm đảo và hoàng hôn.'),(5,4,'Trở về.'),
(6,1,'Thăm đồi chè Tân Cương, học hái và sao chè.'),(6,2,'Hồ Núi Cốc, thưởng trà và trở về.');

ALTER TABLE tours OWNER TO travel_app;
ALTER TABLE itineraries OWNER TO travel_app;
ALTER TABLE customers OWNER TO travel_app;
ALTER TABLE bookings OWNER TO travel_app;
GRANT USAGE ON SCHEMA public TO travel_app;
