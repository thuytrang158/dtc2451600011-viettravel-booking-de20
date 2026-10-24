const grid = document.getElementById('tour-grid');
const modal = document.getElementById('detail-overlay');
const message = document.getElementById('booking-message');
const money = value => new Intl.NumberFormat('vi-VN').format(value) + ' đ';
let tours = [];
const setText = (id, value) => { document.getElementById(id).textContent = value; };
async function loadTours() {
  try {
    const response = await fetch('/api/tours');
    if (!response.ok) throw new Error('Không thể tải danh sách tour');
    tours = await response.json();
    grid.replaceChildren();
    setText('tour-count', tours.length + ' tour đang mở');
    for (const tour of tours) {
      const card = document.createElement('article'); card.className = 'tour-card';
      const photo = document.createElement('img'); photo.className = 'tour-photo'; photo.alt = tour.title;
      photo.loading = 'lazy'; photo.src = tour.image_url || 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=900&q=80';
      const content = document.createElement('div'); content.className = 'tour-content';
      const destination = document.createElement('span'); destination.className = 'destination'; destination.textContent = '✦ ' + tour.destination + '  ·  ' + tour.duration_days + ' ngày';
      const heading = document.createElement('h3'); heading.textContent = tour.title;
      const desc = document.createElement('p'); desc.textContent = tour.description;
      const bottom = document.createElement('div'); bottom.className = 'tour-bottom';
      const price = document.createElement('div');
      const small = document.createElement('div'); small.className = 'small'; small.textContent = 'Giá từ / khách';
      const strong = document.createElement('strong'); strong.textContent = money(tour.price);
      price.append(small, strong);
      const open = document.createElement('button'); open.className = 'open-tour'; open.textContent = 'Chi tiết ↗'; open.onclick = () => showTour(tour);
      bottom.append(price, open); content.append(destination, heading, desc, bottom); card.append(photo, content); grid.append(card);
    }
  } catch (e) { grid.textContent = 'Lỗi kết nối PostgreSQL hoặc website: ' + e.message; }
}
function showTour(tour) {
  setText('detail-title', tour.title); setText('detail-intro', tour.description);
  setText('detail-meta', `${tour.destination}  ·  ${tour.duration_days} ngày  ·  ${money(tour.price)}/khách  ·  Tối đa ${tour.capacity} khách`);
  const itinerary = document.getElementById('itinerary'); itinerary.replaceChildren();
  for (const day of tour.itinerary) {
    const p = document.createElement('p'); const strong = document.createElement('strong'); strong.textContent = 'Ngày ' + day.day + ': ';
    p.append(strong, document.createTextNode(day.details)); itinerary.append(p);
  }
  document.getElementById('tour-id').value = tour.id;
  document.getElementById('booking-form').reset();
  document.getElementById('date').min = new Date().toISOString().slice(0, 10);
  message.textContent = ''; message.className = 'message';
  modal.classList.remove('hidden'); document.body.style.overflow = 'hidden';
}
function hideTour(){modal.classList.add('hidden');document.body.style.overflow='';}
document.getElementById('close-detail').onclick = hideTour;
modal.addEventListener('click', e => { if (e.target === modal) hideTour(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideTour(); });
document.getElementById('booking-form').addEventListener('submit', async e => {
  e.preventDefault(); const button = document.getElementById('book-submit'); button.disabled = true;
  const body = { tour_id: Number(document.getElementById('tour-id').value), full_name: document.getElementById('full-name').value,
    email: document.getElementById('email').value, phone: document.getElementById('phone').value,
    departure_date: document.getElementById('date').value, guests: Number(document.getElementById('guests').value) };
  try {
    const resp = await fetch('/api/bookings', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
    const result = await resp.json(); message.className = 'message ' + (resp.ok ? 'success' : 'error');
    message.textContent = resp.ok ? `✓ Đặt tour thành công! Mã booking #${result.booking_id} – trạng thái: ${result.status}.` : result.error;
    if (resp.ok) e.target.reset();
  } catch { message.className = 'message error'; message.textContent = 'Không thể kết nối máy chủ. Vui lòng thử lại.'; }
  finally { button.disabled = false; }
});
loadTours();
