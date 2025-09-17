import {
	EventDispatcher,
	MOUSE,
	Quaternion,
	Spherical,
	TOUCH,
	Vector2,
	Vector3
} from 'three';

// OrbitControls thực hiện các thao tác quay quanh, phóng to/thu nhỏ (dollying), và di chuyển ngang (panning).
// Khác với TrackballControls, nó duy trì hướng "lên" của đối tượng là object.up (mặc định là +Y).
//
//    Quay quanh - chuột trái / cảm ứng: di chuyển một ngón tay
//    Phóng to - chuột giữa, hoặc bánh xe chuột / cảm ứng: hai ngón tay mở rộng hoặc thu hẹp
//    Di chuyển ngang - chuột phải, hoặc chuột trái + phím ctrl/meta/shift, hoặc phím mũi tên / cảm ứng: di chuyển hai ngón tay

const _changeEvent = { type: 'change' }; // Sự kiện thay đổi
const _startEvent = { type: 'start' }; // Sự kiện bắt đầu
const _endEvent = { type: 'end' }; // Sự kiện kết thúc

class OrbitControls extends EventDispatcher {

	constructor( object, domElement ) {

		super();

		this.object = object; // Đối tượng (thường là camera)
		this.domElement = domElement; // Phần tử DOM để tương tác
		this.domElement.style.touchAction = 'none'; // Tắt cuộn cảm ứng

		// Đặt thành false để vô hiệu hóa điều khiển này
		this.enabled = true;

		// "target" xác định vị trí tiêu điểm, nơi đối tượng quay quanh
		this.target = new Vector3();

		// Khoảng cách tối thiểu và tối đa để phóng to/thu nhỏ (chỉ dành cho PerspectiveCamera)
		this.minDistance = 0;
		this.maxDistance = Infinity;

		// Mức phóng to tối thiểu và tối đa (chỉ dành cho OrthographicCamera)
		this.minZoom = 0;
		this.maxZoom = Infinity;

		// Khoảng cách quay theo chiều dọc, giới hạn trên và dưới.
		// Phạm vi từ 0 đến Math.PI radian.
		this.minPolarAngle = 0; // radian
		this.maxPolarAngle = Math.PI; // radian

		// Khoảng cách quay theo chiều ngang, giới hạn trên và dưới.
		// Nếu được đặt, khoảng [min, max] phải là một khoảng con của [-2 PI, 2 PI], với (max - min < 2 PI)
		this.minAzimuthAngle = - Infinity; // radian
		this.maxAzimuthAngle = Infinity; // radian

		// Đặt thành true để bật giảm chấn (quán tính)
		// Nếu giảm chấn được bật, bạn phải gọi controls.update() trong vòng lặp hoạt hình
		this.enableDamping = false;
		this.dampingFactor = 0.05;

		// Tùy chọn này thực sự bật phóng to/thu nhỏ; được giữ là "zoom" để tương thích ngược.
		// Đặt thành false để vô hiệu hóa phóng to
		this.enableZoom = true;
		this.zoomSpeed = 1.0;

		// Đặt thành false để vô hiệu hóa xoay
		this.enableRotate = true;
		this.rotateSpeed = 1.0;

		// Đặt thành false để vô hiệu hóa di chuyển ngang
		this.enablePan = true;
		this.panSpeed = 1.0;
		this.screenSpacePanning = true; // Nếu false, di chuyển vuông góc với hướng camera.up trong không gian thế giới
		this.keyPanSpeed = 7.0; // Số pixel di chuyển mỗi lần nhấn phím mũi tên

		// Đặt thành true để tự động xoay quanh mục tiêu
		// Nếu tự động xoay được bật, bạn phải gọi controls.update() trong vòng lặp hoạt hình
		this.autoRotate = false;
		this.autoRotateSpeed = 2.0; // 30 giây mỗi vòng quay khi fps là 60

		// Bốn phím mũi tên
		this.keys = { LEFT: 'ArrowLeft', UP: 'ArrowUp', RIGHT: 'ArrowRight', BOTTOM: 'ArrowDown' };

		// Các nút chuột
		this.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN };

		// Các ngón tay cảm ứng
		this.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };

		// Dùng để đặt lại
		this.target0 = this.target.clone();
		this.position0 = this.object.position.clone();
		this.zoom0 = this.object.zoom;

		// Phần tử DOM mục tiêu cho các sự kiện phím
		this._domElementKeyEvents = null;

		//
		// Các phương thức công khai
		//

		this.getPolarAngle = function () {

			return spherical.phi; // Trả về góc cực (phi)

		};

		this.getAzimuthalAngle = function () {

			return spherical.theta; // Trả về góc phương vị (theta)

		};

		this.getDistance = function () {

			return this.object.position.distanceTo( this.target ); // Trả về khoảng cách từ đối tượng đến mục tiêu

		};

		this.listenToKeyEvents = function ( domElement ) {

			domElement.addEventListener( 'keydown', onKeyDown ); // Lắng nghe sự kiện phím nhấn
			this._domElementKeyEvents = domElement;

		};

		this.stopListenToKeyEvents = function () {

			this._domElementKeyEvents.removeEventListener( 'keydown', onKeyDown ); // Ngừng lắng nghe sự kiện phím nhấn
			this._domElementKeyEvents = null;

		};

		this.saveState = function () {

			scope.target0.copy( scope.target ); // Lưu trạng thái mục tiêu
			scope.position0.copy( scope.object.position ); // Lưu trạng thái vị trí
			scope.zoom0 = scope.object.zoom; // Lưu trạng thái mức phóng to

		};

		this.reset = function () {

			scope.target.copy( scope.target0 ); // Đặt lại mục tiêu
			scope.object.position.copy( scope.position0 ); // Đặt lại vị trí
			scope.object.zoom = scope.zoom0; // Đặt lại mức phóng to

			scope.object.updateProjectionMatrix(); // Cập nhật ma trận chiếu
			scope.dispatchEvent( _changeEvent ); // Phát sự kiện thay đổi

			scope.update(); // Cập nhật điều khiển

			state = STATE.NONE; // Đặt trạng thái về không có thao tác

		};

		// Phương thức này được công khai, nhưng có lẽ nên được làm riêng tư...
		this.update = function () {

			const offset = new Vector3();

			// Để camera.up là trục quay
			const quat = new Quaternion().setFromUnitVectors( object.up, new Vector3( 0, 1, 0 ) );
			const quatInverse = quat.clone().invert();

			const lastPosition = new Vector3(); // Vị trí trước đó
			const lastQuaternion = new Quaternion(); // Quaternion trước đó

			const twoPI = 2 * Math.PI;

			return function update() {

				const position = scope.object.position;

				offset.copy( position ).sub( scope.target );

				// Xoay offset sang không gian "y-axis-is-up"
				offset.applyQuaternion( quat );

				// Góc từ trục z quanh trục y
				spherical.setFromVector3( offset );

				if ( scope.autoRotate && state === STATE.NONE ) {

					rotateLeft( getAutoRotationAngle() ); // Xoay trái với góc tự động

				}

				if ( scope.enableDamping ) {

					spherical.theta += sphericalDelta.theta * scope.dampingFactor; // Cập nhật góc phương vị với giảm chấn
					spherical.phi += sphericalDelta.phi * scope.dampingFactor; // Cập nhật góc cực với giảm chấn

				} else {

					spherical.theta += sphericalDelta.theta; // Cập nhật góc phương vị
					spherical.phi += sphericalDelta.phi; // Cập nhật góc cực

				}

				// Giới hạn theta trong khoảng mong muốn

				let min = scope.minAzimuthAngle;
				let max = scope.maxAzimuthAngle;

				if ( isFinite( min ) && isFinite( max ) ) {

					if ( min < - Math.PI ) min += twoPI; else if ( min > Math.PI ) min -= twoPI;

					if ( max < - Math.PI ) max += twoPI; else if ( max > Math.PI ) max -= twoPI;

					if ( min <= max ) {

						spherical.theta = Math.max( min, Math.min( max, spherical.theta ) );

					} else {

						spherical.theta = ( spherical.theta > ( min + max ) / 2 ) ?
							Math.max( min, spherical.theta ) :
							Math.min( max, spherical.theta );

					}

				}

				// Giới hạn phi trong khoảng mong muốn
				spherical.phi = Math.max( scope.minPolarAngle, Math.min( scope.maxPolarAngle, spherical.phi ) );

				spherical.makeSafe(); // Đảm bảo tọa độ hình cầu hợp lệ

				spherical.radius *= scale; // Điều chỉnh bán kính theo tỷ lệ

				// Giới hạn bán kính trong khoảng mong muốn
				spherical.radius = Math.max( scope.minDistance, Math.min( scope.maxDistance, spherical.radius ) );

				// Di chuyển mục tiêu đến vị trí di chuyển ngang

				if ( scope.enableDamping === true ) {

					scope.target.addScaledVector( panOffset, scope.dampingFactor ); // Di chuyển với giảm chấn

				} else {

					scope.target.add( panOffset ); // Di chuyển trực tiếp

				}

				offset.setFromSpherical( spherical );

				// Xoay offset trở lại không gian "camera-up-vector-is-up"
				offset.applyQuaternion( quatInverse );

				position.copy( scope.target ).add( offset );

				scope.object.lookAt( scope.target ); // Hướng camera về mục tiêu

				if ( scope.enableDamping === true ) {

					sphericalDelta.theta *= ( 1 - scope.dampingFactor ); // Giảm góc phương vị
					sphericalDelta.phi *= ( 1 - scope.dampingFactor ); // Giảm góc cực

					panOffset.multiplyScalar( 1 - scope.dampingFactor ); // Giảm offset di chuyển

				} else {

					sphericalDelta.set( 0, 0, 0 ); // Đặt lại delta hình cầu

					panOffset.set( 0, 0, 0 ); // Đặt lại offset di chuyển

				}

				scale = 1; // Đặt lại tỷ lệ

				// Điều kiện cập nhật là:
				// min(sự dịch chuyển của camera, góc xoay của camera tính bằng radian)^2 > EPS
				// sử dụng xấp xỉ góc nhỏ cos(x/2) = 1 - x^2 / 8

				if ( zoomChanged ||
					lastPosition.distanceToSquared( scope.object.position ) > EPS ||
					8 * ( 1 - lastQuaternion.dot( scope.object.quaternion ) ) > EPS ) {

					scope.dispatchEvent( _changeEvent ); // Phát sự kiện thay đổi

					lastPosition.copy( scope.object.position ); // Lưu vị trí hiện tại
					lastQuaternion.copy( scope.object.quaternion ); // Lưu quaternion hiện tại
					zoomChanged = false;

					return true;

				}

				return false;

			};

		}();

		this.dispose = function () {

			scope.domElement.removeEventListener( 'contextmenu', onContextMenu ); // Xóa sự kiện menu ngữ cảnh

			scope.domElement.removeEventListener( 'pointerdown', onPointerDown ); // Xóa sự kiện nhấn con trỏ
			scope.domElement.removeEventListener( 'pointercancel', onPointerUp ); // Xóa sự kiện hủy con trỏ
			scope.domElement.removeEventListener( 'wheel', onMouseWheel ); // Xóa sự kiện cuộn chuột

			scope.domElement.removeEventListener( 'pointermove', onPointerMove ); // Xóa sự kiện di chuyển con trỏ
			scope.domElement.removeEventListener( 'pointerup', onPointerUp ); // Xóa sự kiện thả con trỏ

			if ( scope._domElementKeyEvents !== null ) {

				scope._domElementKeyEvents.removeEventListener( 'keydown', onKeyDown ); // Xóa sự kiện phím nhấn
				scope._domElementKeyEvents = null;

			}

			//scope.dispatchEvent( { type: 'dispose' } ); // Có nên thêm sự kiện này tại đây không?

		};

		//
		// Các thành phần nội bộ
		//

		const scope = this;

		const STATE = {
			NONE: - 1, // Không có thao tác
			ROTATE: 0, // Xoay
			DOLLY: 1, // Phóng to/thu nhỏ
			PAN: 2, // Di chuyển ngang
			TOUCH_ROTATE: 3, // Xoay bằng cảm ứng
			TOUCH_PAN: 4, // Di chuyển ngang bằng cảm ứng
			TOUCH_DOLLY_PAN: 5, // Phóng to/thu nhỏ và di chuyển ngang bằng cảm ứng
			TOUCH_DOLLY_ROTATE: 6 // Phóng to/thu nhỏ và xoay bằng cảm ứng
		};

		let state = STATE.NONE;

		const EPS = 0.000001; // Ngưỡng nhỏ để so sánh

		// Vị trí hiện tại trong tọa độ hình cầu
		const spherical = new Spherical();
		const sphericalDelta = new Spherical();

		let scale = 1; // Tỷ lệ phóng to/thu nhỏ
		const panOffset = new Vector3(); // Offset di chuyển ngang
		let zoomChanged = false; // Cờ thay đổi mức phóng to

		const rotateStart = new Vector2(); // Điểm bắt đầu xoay
		const rotateEnd = new Vector2(); // Điểm kết thúc xoay
		const rotateDelta = new Vector2(); // Delta xoay

		const panStart = new Vector2(); // Điểm bắt đầu di chuyển ngang
		const panEnd = new Vector2(); // Điểm kết thúc di chuyển ngang
		const panDelta = new Vector2(); // Delta di chuyển ngang

		const dollyStart = new Vector2(); // Điểm bắt đầu phóng to/thu nhỏ
		const dollyEnd = new Vector2(); // Điểm kết thúc phóng to/thu nhỏ
		const dollyDelta = new Vector2(); // Delta phóng to/thu nhỏ

		const pointers = []; // Danh sách các con trỏ
		const pointerPositions = {}; // Vị trí của các con trỏ

		function getAutoRotationAngle() {

			return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed; // Tính góc xoay tự động

		}

		function getZoomScale() {

			return Math.pow( 0.95, scope.zoomSpeed ); // Tính tỷ lệ phóng to

		}

		function rotateLeft( angle ) {

			sphericalDelta.theta -= angle; // Xoay trái với góc xác định

		}

		function rotateUp( angle ) {

			sphericalDelta.phi -= angle; // Xoay lên với góc xác định

		}

		const panLeft = function () {

			const v = new Vector3();

			return function panLeft( distance, objectMatrix ) {

				v.setFromMatrixColumn( objectMatrix, 0 ); // Lấy cột X của ma trận đối tượng
				v.multiplyScalar( - distance );

				panOffset.add( v ); // Thêm offset di chuyển ngang

			};

		}();

		const panUp = function () {

			const v = new Vector3();

			return function panUp( distance, objectMatrix ) {

				if ( scope.screenSpacePanning === true ) {

					v.setFromMatrixColumn( objectMatrix, 1 ); // Lấy cột Y của ma trận đối tượng

				} else {

					v.setFromMatrixColumn( objectMatrix, 0 );
					v.crossVectors( scope.object.up, v ); // Tính vector vuông góc với hướng lên của camera

				}

				v.multiplyScalar( distance );

				panOffset.add( v ); // Thêm offset di chuyển ngang

			};

		}();

		// deltaX và deltaY tính bằng pixel; phải và xuống là dương
		const pan = function () {

			const offset = new Vector3();

			return function pan( deltaX, deltaY ) {

				const element = scope.domElement;

				if ( scope.object.isPerspectiveCamera ) {

					// Camera phối cảnh
					const position = scope.object.position;
					offset.copy( position ).sub( scope.target );
					let targetDistance = offset.length();

					// Nửa góc nhìn (fov) là từ trung tâm đến đỉnh màn hình
					targetDistance *= Math.tan( ( scope.object.fov / 2 ) * Math.PI / 180.0 );

					// Chỉ sử dụng clientHeight để tỷ lệ khung hình không làm méo tốc độ
					panLeft( 2 * deltaX * targetDistance / element.clientHeight, scope.object.matrix );
					panUp( 2 * deltaY * targetDistance / element.clientHeight, scope.object.matrix );

				} else if ( scope.object.isOrthographicCamera ) {

					// Camera chính diện
					panLeft( deltaX * ( scope.object.right - scope.object.left ) / scope.object.zoom / element.clientWidth, scope.object.matrix );
					panUp( deltaY * ( scope.object.top - scope.object.bottom ) / scope.object.zoom / element.clientHeight, scope.object.matrix );

				} else {

					// Camera không phải chính diện cũng không phải phối cảnh
					console.warn( 'CẢNH BÁO: OrbitControls.js gặp loại camera không xác định - di chuyển ngang bị vô hiệu hóa.' );
					scope.enablePan = false;

				}

			};

		}();

		function dollyOut( dollyScale ) {

			if ( scope.object.isPerspectiveCamera ) {

				scale /= dollyScale; // Thu nhỏ

			} else if ( scope.object.isOrthographicCamera ) {

				scope.object.zoom = Math.max( scope.minZoom, Math.min( scope.maxZoom, scope.object.zoom * dollyScale ) ); // Phóng to/thu nhỏ mức zoom
				scope.object.updateProjectionMatrix(); // Cập nhật ma trận chiếu
				zoomChanged = true;

			} else {

				console.warn( 'CẢNH BÁO: OrbitControls.js gặp loại camera không xác định - phóng to/thu nhỏ bị vô hiệu hóa.' );
				scope.enableZoom = false;

			}

		}

		function dollyIn( dollyScale ) {

			if ( scope.object.isPerspectiveCamera ) {

				scale *= dollyScale; // Phóng to

			} else if ( scope.object.isOrthographicCamera ) {

				scope.object.zoom = Math.max( scope.minZoom, Math.min( scope.maxZoom, scope.object.zoom / dollyScale ) ); // Phóng to/thu nhỏ mức zoom
				scope.object.updateProjectionMatrix(); // Cập nhật ma trận chiếu
				zoomChanged = true;

			} else {

				console.warn( 'CẢNH BÁO: OrbitControls.js gặp loại camera không xác định - phóng to/thu nhỏ bị vô hiệu hóa.' );
				scope.enableZoom = false;

			}

		}

		//
		// Các hàm gọi lại sự kiện - cập nhật trạng thái đối tượng
		//

		function handleMouseDownRotate( event ) {

			rotateStart.set( event.clientX, event.clientY ); // Ghi lại điểm bắt đầu xoay

		}

		function handleMouseDownDolly( event ) {

			dollyStart.set( event.clientX, event.clientY ); // Ghi lại điểm bắt đầu phóng to/thu nhỏ

		}

		function handleMouseDownPan( event ) {

			panStart.set( event.clientX, event.clientY ); // Ghi lại điểm bắt đầu di chuyển ngang

		}

		function handleMouseMoveRotate( event ) {

			rotateEnd.set( event.clientX, event.clientY ); // Ghi lại điểm kết thúc xoay

			rotateDelta.subVectors( rotateEnd, rotateStart ).multiplyScalar( scope.rotateSpeed ); // Tính delta xoay

			const element = scope.domElement;

			rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientHeight ); // Xoay trái (dựa trên chiều cao)

			rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight ); // Xoay lên

			rotateStart.copy( rotateEnd ); // Cập nhật điểm bắt đầu

			scope.update(); // Cập nhật điều khiển

		}

		function handleMouseMoveDolly( event ) {

			dollyEnd.set( event.clientX, event.clientY ); // Ghi lại điểm kết thúc phóng to/thu nhỏ

			dollyDelta.subVectors( dollyEnd, dollyStart ); // Tính delta phóng to/thu nhỏ

			if ( dollyDelta.y > 0 ) {

				dollyOut( getZoomScale() ); // Thu nhỏ

			} else if ( dollyDelta.y < 0 ) {

				dollyIn( getZoomScale() ); // Phóng to

			}

			dollyStart.copy( dollyEnd ); // Cập nhật điểm bắt đầu

			scope.update(); // Cập nhật điều khiển

		}

		function handleMouseMovePan( event ) {

			panEnd.set( event.clientX, event.clientY ); // Ghi lại điểm kết thúc di chuyển ngang

			panDelta.subVectors( panEnd, panStart ).multiplyScalar( scope.panSpeed ); // Tính delta di chuyển ngang

			pan( panDelta.x, panDelta.y ); // Di chuyển ngang

			panStart.copy( panEnd ); // Cập nhật điểm bắt đầu

			scope.update(); // Cập nhật điều khiển

		}

		function handleMouseWheel( event ) {

			if ( event.deltaY < 0 ) {

				dollyIn( getZoomScale() ); // Phóng to

			} else if ( event.deltaY > 0 ) {

				dollyOut( getZoomScale() ); // Thu nhỏ

			}

			scope.update(); // Cập nhật điều khiển

		}

		function handleKeyDown( event ) {

			let needsUpdate = false;

			switch ( event.code ) {

				case scope.keys.UP:

					if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

						rotateUp( 2 * Math.PI * scope.rotateSpeed / scope.domElement.clientHeight ); // Xoay lên

					} else {

						pan( 0, scope.keyPanSpeed ); // Di chuyển lên

					}

					needsUpdate = true;
					break;

				case scope.keys.BOTTOM:

					if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

						rotateUp( - 2 * Math.PI * scope.rotateSpeed / scope.domElement.clientHeight ); // Xoay xuống

					} else {

						pan( 0, - scope.keyPanSpeed ); // Di chuyển xuống

					}

					needsUpdate = true;
					break;

				case scope.keys.LEFT:

					if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

						rotateLeft( 2 * Math.PI * scope.rotateSpeed / scope.domElement.clientHeight ); // Xoay trái

					} else {

						pan( scope.keyPanSpeed, 0 ); // Di chuyển trái

					}

					needsUpdate = true;
					break;

				case scope.keys.RIGHT:

					if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

						rotateLeft( - 2 * Math.PI * scope.rotateSpeed / scope.domElement.clientHeight ); // Xoay phải

					} else {

						pan( - scope.keyPanSpeed, 0 ); // Di chuyển phải

					}

					needsUpdate = true;
					break;

			}

			if ( needsUpdate ) {

				// Ngăn trình duyệt cuộn khi sử dụng phím mũi tên
				event.preventDefault();

				scope.update(); // Cập nhật điều khiển

			}

		}

		function handleTouchStartRotate() {

			if ( pointers.length === 1 ) {

				rotateStart.set( pointers[ 0 ].pageX, pointers[ 0 ].pageY ); // Ghi lại điểm bắt đầu xoay (một ngón)

			} else {

				const x = 0.5 * ( pointers[ 0 ].pageX + pointers[ 1 ].pageX );
				const y = 0.5 * ( pointers[ 0 ].pageY + pointers[ 1 ].pageY );

				rotateStart.set( x, y ); // Ghi lại điểm bắt đầu xoay (hai ngón)

			}

		}

		function handleTouchStartPan() {

			if ( pointers.length === 1 ) {

				panStart.set( pointers[ 0 ].pageX, pointers[ 0 ].pageY ); // Ghi lại điểm bắt đầu di chuyển ngang (một ngón)

			} else {

				const x = 0.5 * ( pointers[ 0 ].pageX + pointers[ 1 ].pageX );
				const y = 0.5 * ( pointers[ 0 ].pageY + pointers[ 1 ].pageY );

				panStart.set( x, y ); // Ghi lại điểm bắt đầu di chuyển ngang (hai ngón)

			}

		}

		function handleTouchStartDolly() {

			const dx = pointers[ 0 ].pageX - pointers[ 1 ].pageX;
			const dy = pointers[ 0 ].pageY - pointers[ 1 ].pageY;

			const distance = Math.sqrt( dx * dx + dy * dy ); // Tính khoảng cách giữa hai ngón

			dollyStart.set( 0, distance ); // Ghi lại điểm bắt đầu phóng to/thu nhỏ

		}

		function handleTouchStartDollyPan() {

			if ( scope.enableZoom ) handleTouchStartDolly(); // Xử lý bắt đầu phóng to/thu nhỏ

			if ( scope.enablePan ) handleTouchStartPan(); // Xử lý bắt đầu di chuyển ngang

		}

		function handleTouchStartDollyRotate() {

			if ( scope.enableZoom ) handleTouchStartDolly(); // Xử lý bắt đầu phóng to/thu nhỏ

			if ( scope.enableRotate ) handleTouchStartRotate(); // Xử lý bắt đầu xoay

		}

		function handleTouchMoveRotate( event ) {

			if ( pointers.length == 1 ) {

				rotateEnd.set( event.pageX, event.pageY ); // Ghi lại điểm kết thúc xoay (một ngón)

			} else {

				const position = getSecondPointerPosition( event );

				const x = 0.5 * ( event.pageX + position.x );
				const y = 0.5 * ( event.pageY + position.y );

				rotateEnd.set( x, y ); // Ghi lại điểm kết thúc xoay (hai ngón)

			}

			rotateDelta.subVectors( rotateEnd, rotateStart ).multiplyScalar( scope.rotateSpeed ); // Tính delta xoay

			const element = scope.domElement;

			rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientHeight ); // Xoay trái (dựa trên chiều cao)

			rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight ); // Xoay lên

			rotateStart.copy( rotateEnd ); // Cập nhật điểm bắt đầu

		}

		function handleTouchMovePan( event ) {

			if ( pointers.length === 1 ) {

				panEnd.set( event.pageX, event.pageY ); // Ghi lại điểm kết thúc di chuyển ngang (một ngón)

			} else {

				const position = getSecondPointerPosition( event );

				const x = 0.5 * ( event.pageX + position.x );
				const y = 0.5 * ( event.pageY + position.y );

				panEnd.set( x, y ); // Ghi lại điểm kết thúc di chuyển ngang (hai ngón)

			}

			panDelta.subVectors( panEnd, panStart ).multiplyScalar( scope.panSpeed ); // Tính delta di chuyển ngang

			pan( panDelta.x, panDelta.y ); // Di chuyển ngang

			panStart.copy( panEnd ); // Cập nhật điểm bắt đầu

		}

		function handleTouchMoveDolly( event ) {

			const position = getSecondPointerPosition( event );

			const dx = event.pageX - position.x;
			const dy = event.pageY - position.y;

			const distance = Math.sqrt( dx * dx + dy * dy ); // Tính khoảng cách giữa hai ngón

			dollyEnd.set( 0, distance ); // Ghi lại điểm kết thúc phóng to/thu nhỏ

			dollyDelta.set( 0, Math.pow( dollyEnd.y / dollyStart.y, scope.zoomSpeed ) ); // Tính delta phóng to/thu nhỏ

			dollyOut( dollyDelta.y ); // Thu nhỏ

			dollyStart.copy( dollyEnd ); // Cập nhật điểm bắt đầu

		}

		function handleTouchMoveDollyPan( event ) {

			if ( scope.enableZoom ) handleTouchMoveDolly( event ); // Xử lý di chuyển phóng to/thu nhỏ

			if ( scope.enablePan ) handleTouchMovePan( event ); // Xử lý di chuyển ngang

		}

		function handleTouchMoveDollyRotate( event ) {

			if ( scope.enableZoom ) handleTouchMoveDolly( event ); // Xử lý di chuyển phóng to/thu nhỏ

			if ( scope.enableRotate ) handleTouchMoveRotate( event ); // Xử lý di chuyển xoay

		}

		//
		// Các trình xử lý sự kiện - FSM: lắng nghe sự kiện và đặt lại trạng thái
		//

		function onPointerDown( event ) {

			if ( scope.enabled === false ) return;

			if ( pointers.length === 0 ) {

				scope.domElement.setPointerCapture( event.pointerId ); // Bắt giữ con trỏ

				scope.domElement.addEventListener( 'pointermove', onPointerMove ); // Thêm sự kiện di chuyển con trỏ
				scope.domElement.addEventListener( 'pointerup', onPointerUp ); // Thêm sự kiện thả con trỏ

			}

			//

			addPointer( event ); // Thêm con trỏ

			if ( event.pointerType === 'touch' ) {

				onTouchStart( event ); // Xử lý bắt đầu cảm ứng

			} else {

				onMouseDown( event ); // Xử lý nhấn chuột

			}

		}

		function onPointerMove( event ) {

			if ( scope.enabled === false ) return;

			if ( event.pointerType === 'touch' ) {

				onTouchMove( event ); // Xử lý di chuyển cảm ứng

			} else {

				onMouseMove( event ); // Xử lý di chuyển chuột

			}

		}

		function onPointerUp( event ) {

			removePointer( event ); // Xóa con trỏ

			if ( pointers.length === 0 ) {

				scope.domElement.releasePointerCapture( event.pointerId ); // Thả bắt giữ con trỏ

				scope.domElement.removeEventListener( 'pointermove', onPointerMove ); // Xóa sự kiện di chuyển con trỏ
				scope.domElement.removeEventListener( 'pointerup', onPointerUp ); // Xóa sự kiện thả con trỏ

			}

			scope.dispatchEvent( _endEvent ); // Phát sự kiện kết thúc

			state = STATE.NONE; // Đặt trạng thái về không có thao tác

		}

		function onMouseDown( event ) {

			let mouseAction;

			switch ( event.button ) {

				case 0:

					mouseAction = scope.mouseButtons.LEFT; // Nút chuột trái
					break;

				case 1:

					mouseAction = scope.mouseButtons.MIDDLE; // Nút chuột giữa
					break;

				case 2:

					mouseAction = scope.mouseButtons.RIGHT; // Nút chuột phải
					break;

				default:

					mouseAction = - 1;

			}

			switch ( mouseAction ) {

				case MOUSE.DOLLY:

					if ( scope.enableZoom === false ) return;

					handleMouseDownDolly( event ); // Xử lý nhấn chuột để phóng to/thu nhỏ

					state = STATE.DOLLY;

					break;

				case MOUSE.ROTATE:

					if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

						if ( scope.enablePan === false ) return;

						handleMouseDownPan( event ); // Xử lý nhấn chuột để di chuyển ngang

						state = STATE.PAN;

					} else {

						if ( scope.enableRotate === false ) return;

						handleMouseDownRotate( event ); // Xử lý nhấn chuột để xoay

						state = STATE.ROTATE;

					}

					break;

				case MOUSE.PAN:

					if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

						if ( scope.enableRotate === false ) return;

						handleMouseDownRotate( event ); // Xử lý nhấn chuột để xoay

						state = STATE.ROTATE;

					} else {

						if ( scope.enablePan === false ) return;

						handleMouseDownPan( event ); // Xử lý nhấn chuột để di chuyển ngang

						state = STATE.PAN;

					}

					break;

				default:

					state = STATE.NONE;

			}

			if ( state !== STATE.NONE ) {

				scope.dispatchEvent( _startEvent ); // Phát sự kiện bắt đầu

			}

		}

		function onMouseMove( event ) {

			switch ( state ) {

				case STATE.ROTATE:

					if ( scope.enableRotate === false ) return;

					handleMouseMoveRotate( event ); // Xử lý di chuyển chuột để xoay

					break;

				case STATE.DOLLY:

					if ( scope.enableZoom === false ) return;

					handleMouseMoveDolly( event ); // Xử lý di chuyển chuột để phóng to/thu nhỏ

					break;

				case STATE.PAN:

					if ( scope.enablePan === false ) return;

					handleMouseMovePan( event ); // Xử lý di chuyển chuột để di chuyển ngang

					break;

			}

		}

		function onMouseWheel( event ) {

			if ( scope.enabled === false || scope.enableZoom === false || state !== STATE.NONE ) return;

			event.preventDefault(); // Ngăn hành vi mặc định

			scope.dispatchEvent( _startEvent ); // Phát sự kiện bắt đầu

			handleMouseWheel( event ); // Xử lý cuộn chuột

			scope.dispatchEvent( _endEvent ); // Phát sự kiện kết thúc

		}

		function onKeyDown( event ) {

			if ( scope.enabled === false || scope.enablePan === false ) return;

			handleKeyDown( event ); // Xử lý phím nhấn

		}

		function onTouchStart( event ) {

			trackPointer( event ); // Theo dõi con trỏ

			switch ( pointers.length ) {

				case 1:

					switch ( scope.touches.ONE ) {

						case TOUCH.ROTATE:

							if ( scope.enableRotate === false ) return;

							handleTouchStartRotate(); // Xử lý bắt đầu xoay bằng cảm ứng

							state = STATE.TOUCH_ROTATE;

							break;

						case TOUCH.PAN:

							if ( scope.enablePan === false ) return;

							handleTouchStartPan(); // Xử lý bắt đầu di chuyển ngang bằng cảm ứng

							state = STATE.TOUCH_PAN;

							break;

						default:

							state = STATE.NONE;

					}

					break;

				case 2:

					switch ( scope.touches.TWO ) {

						case TOUCH.DOLLY_PAN:

							if ( scope.enableZoom === false && scope.enablePan === false ) return;

							handleTouchStartDollyPan(); // Xử lý bắt đầu phóng to/thu nhỏ và di chuyển ngang

							state = STATE.TOUCH_DOLLY_PAN;

							break;

						case TOUCH.DOLLY_ROTATE:

							if ( scope.enableZoom === false && scope.enableRotate === false ) return;

							handleTouchStartDollyRotate(); // Xử lý bắt đầu phóng to/thu nhỏ và xoay

							state = STATE.TOUCH_DOLLY_ROTATE;

							break;

						default:

							state = STATE.NONE;

					}

					break;

				default:

					state = STATE.NONE;

			}

			if ( state !== STATE.NONE ) {

				scope.dispatchEvent( _startEvent ); // Phát sự kiện bắt đầu

			}

		}

		function onTouchMove( event ) {

			trackPointer( event ); // Theo dõi con trỏ

			switch ( state ) {

				case STATE.TOUCH_ROTATE:

					if ( scope.enableRotate === false ) return;

					handleTouchMoveRotate( event ); // Xử lý di chuyển xoay bằng cảm ứng

					scope.update(); // Cập nhật điều khiển

					break;

				case STATE.TOUCH_PAN:

					if ( scope.enablePan === false ) return;

					handleTouchMovePan( event ); // Xử lý di chuyển ngang bằng cảm ứng

					scope.update(); // Cập nhật điều khiển

					break;

				case STATE.TOUCH_DOLLY_PAN:

					if ( scope.enableZoom === false && scope.enablePan === false ) return;

					handleTouchMoveDollyPan( event ); // Xử lý di chuyển phóng to/thu nhỏ và di chuyển ngang

					scope.update(); // Cập nhật điều khiển

					break;

				case STATE.TOUCH_DOLLY_ROTATE:

					if ( scope.enableZoom === false && scope.enableRotate === false ) return;

					handleTouchMoveDollyRotate( event ); // Xử lý di chuyển phóng to/thu nhỏ và xoay

					scope.update(); // Cập nhật điều khiển

					break;

				default:

					state = STATE.NONE;

			}

		}

		function onContextMenu( event ) {

			if ( scope.enabled === false ) return;

			event.preventDefault(); // Ngăn menu ngữ cảnh

		}

		function addPointer( event ) {

			pointers.push( event ); // Thêm con trỏ vào danh sách

		}

		function removePointer( event ) {

			delete pointerPositions[ event.pointerId ]; // Xóa vị trí con trỏ

			for ( let i = 0; i < pointers.length; i ++ ) {

				if ( pointers[ i ].pointerId == event.pointerId ) {

					pointers.splice( i, 1 ); // Xóa con trỏ khỏi danh sách
					return;

				}

			}

		}

		function trackPointer( event ) {

			let position = pointerPositions[ event.pointerId ];

			if ( position === undefined ) {

				position = new Vector2();
				pointerPositions[ event.pointerId ] = position; // Tạo vị trí mới cho con trỏ

			}

			position.set( event.pageX, event.pageY ); // Cập nhật vị trí con trỏ

		}

		function getSecondPointerPosition( event ) {

			const pointer = ( event.pointerId === pointers[ 0 ].pointerId ) ? pointers[ 1 ] : pointers[ 0 ];

			return pointerPositions[ pointer.pointerId ]; // Trả về vị trí của con trỏ thứ hai

		}

		//

		scope.domElement.addEventListener( 'contextmenu', onContextMenu ); // Thêm sự kiện menu ngữ cảnh

		scope.domElement.addEventListener( 'pointerdown', onPointerDown ); // Thêm sự kiện nhấn con trỏ
		scope.domElement.addEventListener( 'pointercancel', onPointerUp ); // Thêm sự kiện hủy con trỏ
		scope.domElement.addEventListener( 'wheel', onMouseWheel, { passive: false } ); // Thêm sự kiện cuộn chuột

		// Buộc cập nhật khi khởi động

		this.update();

	}

}

export { OrbitControls };