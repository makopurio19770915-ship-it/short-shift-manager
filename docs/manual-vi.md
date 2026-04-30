# Quản lý ca làm ngắn hạn — Hướng dẫn sử dụng (Tiếng Việt)

Tài liệu này hướng dẫn cách dùng ứng dụng web « Quản lý ca làm ngắn hạn ». Tên menu và thuật ngữ trên màn hình trùng với ứng dụng.

---

## 1. Ứng dụng dùng để làm gì

Quy trình sau được xử lý trong trình duyệt:

1. **Nhân viên gửi mong muốn ca làm**
2. **Quản trị duyệt đơn: duyệt, yêu cầu chỉnh sửa hoặc từ chối**
3. **Chỉnh lịch theo ngày và khung giờ, rồi công khai cho hiện trường**
4. **Ở hiện trường xem ca đã công khai và ghi chú bộ phận**

---

## 2. URL sử dụng (quan trọng)

Trong vận hành, **hãy chia sẻ URL theo vai trò**.

| Đối tượng | URL | Giải thích |
|-----------|-----|------------|
| **Nhân viên / lao động ngắn hạn** | `https://(trang-web-của-bạn)/` | Chỉ hiển thị **màn hình gửi mong muốn ca làm** (không có tab). |
| **Quản trị nội bộ** | `https://(trang-web-của-bạn)/admin` | Dùng được **đầy đủ các tab** (danh sách đơn, danh sách nhân viên, tạo ca, hiện trường…). |

※ Ví dụ: `https://short-shift-manager.onrender.com/` và `https://short-shift-manager.onrender.com/admin`  
※ Hãy thay bằng URL thực tế hiển thị trên máy chủ (Render v.v.) của bạn.

### Lưu ý bảo mật (vận hành)

Việc tách URL chỉ nhằm **tách giao diện hiển thị**. **Không phải** biện pháp cách ly dữ liệu hoàn toàn về mặt kỹ thuật.  
Nếu cần phân quyền chặt hơn, cần bổ sung đăng nhập, token, v.v.

---

## 3. Ngôn ngữ (Tiếng Nhật / Tiếng Việt)

- Dùng nút **「日本語」「Tiếng Việt」** ở đầu trang, hoặc hộp chọn **「言語／Ngôn ngữ」**.
- Ngôn ngữ chọn được lưu trên trình duyệt của thiết bị (local storage).

---

## 4. Dành cho nhân viên (màn hình gốc `/`)

### 4.1 Gửi mong muốn ca làm

1. Chọn **nhân viên** (danh sách do quản trị đăng ký trước trong master).
2. Nhập **ngày giờ muốn làm**.
   - Nhập **ngày, bắt đầu, kết thúc** cho từng dòng.
   - Nhiều ngày: bấm **「＋ 日時を追加」** để thêm dòng.
   - Dòng thừa: bấm **「削除」**.
3. Nếu cần, ghi **ghi chú tự do**.
4. Bấm **「希望を送信」** (hoặc bản dịch tiếng Việt: **Gửi mong muốn**).

Không thể gửi nếu **cả khung giờ và ghi chú đều trống**. **Phải có ít nhất một trong hai.**

---

## 5. Dành cho quản trị (`/admin`)

Khi mở bằng URL quản trị, phía trên có **các tab**.

### 5.1 Gửi mong muốn ca làm

Dùng khi nhập thay cho nhân viên. Thao tác giống mục **4.**

### 5.2 Quản trị · Danh sách đơn

- Các đơn mong muốn ca làm hiển thị dạng danh sách.
- Tick **« Chỉ chưa xử lý »** để chỉ xem đơn chưa xử lý.
- Tab có thể có **huy hiệu đỏ con số** (số đơn **chờ duyệt** mà admin chưa « mở tab xem »). Khi **mở tab này**, hệ thống coi như đã xem và huy hiệu sẽ hết.
- Số **#** trên mỗi dòng là **số thứ tự hiển thị theo tháng dương lịch múi giờ Tokyo** (tháng mới lại bắt đầu từ 1).  
  **ID nội bộ trên máy chủ khác với số #; dữ liệu không bị xóa.**
- Đơn **chờ duyệt** có các nút:
  - **Duyệt / chỉnh**: xem nội dung, chỉnh giờ nếu cần rồi duyệt.
  - **Yêu cầu chỉnh sửa**: ghi nhận yêu cầu nhân viên sửa lại.
  - **Từ chối**: từ chối đơn.
- Đơn **không còn chờ duyệt** có thể **xóa khỏi danh sách** (chỉ ẩn khỏi danh sách; dữ liệu đã nhập trên bảng ca có thể vẫn còn).
- **Đơn đang chờ duyệt không xóa khỏi danh sách được** (theo quy tắc ứng dụng).

### 5.3 Danh sách nhân viên (master)

- Nhập **mã** và **họ tên**, bấm **「Thêm»** để đăng ký.
- Danh này xuất hiện trong ô chọn nhân viên ở màn hình gửi mong muốn.
- Có thể xóa bằng ✕ (cẩn thận: ảnh hưởng đơn và bảng ca liên quan).

### 5.4 Tạo ca (lịch)

- Chọn **ngày**, nhập ma trận **nhân viên × khung giờ (6h–21h)**.
- Nhấp ô: **trống → 1 giờ → 0,5 giờ → trống**.
- **Điền từ đơn đã duyệt**: tự điền từ mong muốn đã duyệt trong ngày đó.
- **Xóa ô của ngày này**: xóa toàn bộ ô của ngày.
- **Lưu ca**: lưu lên máy chủ.
- **Công khai cho hiện trường**: để tab **Hiện trường** xem được.
- **Xuất CSV**: tải CSV cho ngày đó.
- Ngày đã công khai sẽ có thông báo tương ứng trên màn hình.

### 5.5 Hiện trường

**Phần trên:** Thêm bộ phận vào menu (tùy chọn)

- Nhập đủ **tên tiếng Nhật** và **tên tiếng Việt**, bấm thêm.
- Có thể xóa bộ phận đã thêm trong danh sách.

**Phần dưới:** Ca đã công khai và ghi chú bộ phận

- Chọn **ngày**. Chỉ các ngày đã **« Công khai cho hiện trường »** trong tab Tạo ca mới có danh sách.
- Menu **bộ phận** là **ghi chú vận hành** (ai dùng ở bộ phận nào).
- Bấm **Lưu ghi chú bộ phận** để lưu.

---

## 6. Lưu trữ dữ liệu

Trên môi trường thật, dữ liệu thường lưu trên **MongoDB Atlas** (cơ sở dữ liệu đám mây), không phụ thuộc máy tính cá nhân bật/tắt; mọi người truy cập Internet đều thấy cùng dữ liệu.

Môi trường dev có thể lưu file trên máy chủ (tùy cấu hình).

---

## 7. Gặp sự cố — kiểm tra nhanh

| Hiện tượng | Việc cần kiểm tra |
|------------|-------------------|
| Không gửi được đơn | Đã chọn nhân viên chưa / đã nhập giờ hoặc ghi chú chưa |
| Không thấy đơn trong danh sách | Đang mở **URL `/admin`** chưa / bộ lọc « chỉ chưa xử lý » |
| Hiện trường không có ai | Đã nhập ca và **công khai** cho ngày đó chưa |
| Không thấy tab | URL gốc `/` chỉ dành cho nhân viên — **không có tab**. Dùng **`/admin`**. |

---

## 8. Liên hệ và tùy chỉnh

Quy tắc vận hành và yêu cầu phân quyền mạnh hơn, vui lòng trao đổi với bộ phận IT của đơn vị.
