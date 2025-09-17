import { ExtrudeGeometry } from 'three';

/**
* TextGeometry mở rộng ExtrudeGeometry để tạo hình dạng văn bản 3D.
 *
 * @param {string} text - Chuỗi văn bản để tạo hình học.
 * @param {Object} parameters - Các tham số cấu hình.
 * @param {THREE.Font} parameters.font - Phông chữ sử dụng (bắt buộc).
 * @param {number} [parameters.size=100] - Kích thước phông chữ.
 * @param {number} [parameters.height=45] - Độ dày để đùn văn bản (chiều sâu 3D).
 * @param {number} [parameters.curveSegments=12] - Số điểm trên các đường cong.
 * @param {boolean} [parameters.bevelEnabled=false] - Bật hiệu ứng vát cạnh.
 * @param {number} [parameters.bevelThickness=10] - Độ dày phần vát.
 * @param {number} [parameters.bevelSize=8] - Kích thước phần vát.
 * @param {number} [parameters.bevelOffset=0] - Độ lệch của phần vát.
 * @param {number} [parameters.bevelSegments=3] - Số đoạn phân chia của phần vát.
 */

class TextGeometry extends ExtrudeGeometry {

  constructor(text, parameters = {}) {

    const font = parameters.font;

    if (!font || typeof font.generateShapes !== 'function') {
      console.warn('TextGeometry: font parameter is required and must be a THREE.Font instance.');
      super(); // quay lại hình học rỗng
      this.type = 'TextGeometry';
      return;
    }

   // Đặt tham số mặc định nếu không được cung cấp
    const size = parameters.size !== undefined ? parameters.size : 100;
    const height = parameters.height !== undefined ? parameters.height : 50;
    const curveSegments = parameters.curveSegments !== undefined ? parameters.curveSegments : 12;
    const bevelEnabled = parameters.bevelEnabled !== undefined ? parameters.bevelEnabled : false;
    const bevelThickness = parameters.bevelThickness !== undefined ? parameters.bevelThickness : 10;
    const bevelSize = parameters.bevelSize !== undefined ? parameters.bevelSize : 8;
    const bevelOffset = parameters.bevelOffset !== undefined ? parameters.bevelOffset : 0;
    const bevelSegments = parameters.bevelSegments !== undefined ? parameters.bevelSegments : 3;

    // Tạo hình dạng từ phông chữ
    const shapes = font.generateShapes(text, size);

    // Prepare extrude settings
    const extrudeSettings = {
      depth: height,
      bevelEnabled: bevelEnabled,
      bevelThickness: bevelThickness,
      bevelSize: bevelSize,
      bevelOffset: bevelOffset,
      bevelSegments: bevelSegments,
      curveSegments: curveSegments
    };

    super(shapes, extrudeSettings);

    this.type = 'TextGeometry';
  }
}

export { TextGeometry };