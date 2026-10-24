let auth = '';
let tours = [];
const msg = id => document.getElementById(id);
async function api(url, options = {}) {
  const resp = await fetch(url, { ...options, headers: { 'Authorization': 'Basic ' + auth, ...(options.body ? {'Content-Type':'application/json'} : {}) } });
  const result = await resp.json();
  if (!resp.ok) throw new Error(result.error || `HTTP ${resp.status}`);
  return result;
}
msg('login-form').addEventListener('submit', async e => {
  e.preventDefault(); const data = new FormData(e.target);
  auth = btoa(String(data.get('username')) + ':' + String(data.get('password')));
  try {
    await api('/api/admin/bookings'); msg('login-panel').classList.add('hidden'); msg('admin-content').classList.remove('hidden');
    e.target.reset(); await refresh();
  } catch (err) { auth = ''; msg('login-message').textContent = err.message; }
});
msg('logout').onclick = () => { auth = ''; msg('admin-content').classList.add('hidden'); msg('login-panel').classList.remove('hidden'); };
const td = (tr, value) => { const x = document.createElement('td'); x.textContent = String(value); tr.append(x); return x; };
async function refresh() {
  try { await Promise.all([listBookings(), listTours()]); }
  catch(err) { alert('Không thể làm mới: '+err.message); }
}
async function listBookings() {
  const bookings = await api('/api/admin/bookings');
  const container = msg('booking-list'); container.replaceChildren();
  if (!bookings.length) { container.textContent='Chưa có booking. Hãy thử đặt tour từ trang chủ.'; return; }
  const table = document.createElement('table');
  const head = document.createElement('tr'); for(const name of ['Mã','Tên khách','Tour','Khởi hành','Số khách','Liên hệ','Trạng thái']) {const th=document.createElement('th');th.textContent=name;head.append(th);} table.append(head);
  for (const b of bookings) {
    const tr=document.createElement('tr');td(tr,'#'+b.id);td(tr,b.full_name);td(tr,b.tour_title);td(tr,String(b.departure_date).slice(0,10));td(tr,b.guests);td(tr,b.email+' / '+b.phone);
    const cell=td(tr,''); const sel=document.createElement('select');
    for(const state of ['pending','confirmed','cancelled']) {const opt=document.createElement('option');opt.value=state;opt.textContent=state;sel.append(opt);}sel.value=b.status;
    sel.onchange=async()=>{try{await api('/api/admin/bookings/'+b.id,{method:'PATCH',body:JSON.stringify({status:sel.value})});}catch(err){alert(err.message);sel.value=b.status;}};
    cell.append(sel);table.append(tr);
  }
  container.append(table);
}
async function listTours() {
  tours = await fetch('/api/tours').then(r => r.json());
  const container=msg('manage-tours');container.replaceChildren();
  const table=document.createElement('table'); const head=document.createElement('tr');
  for(const label of ['ID','Tên tour','Điểm đến','Giá','Thao tác']){const th=document.createElement('th');th.textContent=label;head.append(th);}table.append(head);
  for(const tour of tours){
    const tr=document.createElement('tr');td(tr,tour.id);td(tr,tour.title);td(tr,tour.destination);td(tr,new Intl.NumberFormat('vi-VN').format(tour.price)+'đ');
    const actions=td(tr,'');const edit=document.createElement('button');edit.className='secondary-btn';edit.textContent='Sửa';edit.onclick=()=>editTour(tour);
    const del=document.createElement('button');del.className='secondary-btn';del.style.marginLeft='8px';del.textContent='Xóa';
    del.onclick=async()=>{if(!confirm('Bạn chắc chắn muốn xóa tour '+tour.title+'?'))return;
      try{await api('/api/admin/tours/'+tour.id,{method:'DELETE'});await refresh();}catch(err){alert(err.message);}};
    actions.append(edit,del);table.append(tr);
  } container.append(table);
}
const form=msg('tour-form');
function editTour(t){
  for(const field of ['title','destination','description','duration_days','price','capacity','image_url']) form.elements.namedItem(field).value=t[field];
  form.elements.namedItem('itinerary').value=t.itinerary.map(i=>i.details).join('\n');
  form.elements.namedItem('tour_id').value=t.id;
  msg('tour-form-title').textContent='Sửa tour #'+t.id;
  form.scrollIntoView({behavior:'smooth'});
}
msg('reset-tour').onclick=()=>{form.reset();form.elements.namedItem('tour_id').value='';msg('tour-form-title').textContent='Thêm tour mới';};
form.addEventListener('submit', async e=>{
  e.preventDefault();const d=new FormData(form);const id=String(d.get('tour_id'));
  const body={title:d.get('title'),destination:d.get('destination'),duration_days:Number(d.get('duration_days')),
    price:Number(d.get('price')),capacity:Number(d.get('capacity')),image_url:d.get('image_url'),description:d.get('description'),
    itinerary:String(d.get('itinerary')).split('\n').map(x=>x.trim()).filter(Boolean)};
  try{const item=await api(id?'/api/admin/tours/'+id:'/api/admin/tours',{method:id?'PUT':'POST',body:JSON.stringify(body)});
    msg('tour-message').textContent='Đã lưu tour #'+item.id;
    msg('reset-tour').click();await refresh();
  }catch(err){msg('tour-message').textContent='Lỗi: '+err.message;}
});
