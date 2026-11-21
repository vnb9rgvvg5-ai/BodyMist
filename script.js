/* ==========================================================
   Body Scent — script.js (ใช้ร่วมกันทุกหน้า)
   - product.html : #filter-bar, #product-list
   - order.html   : #orderForm, #customerName, #contact, #items, #total, #note
   - admin.html   : #ordersTable tbody
   ========================================================== */

(function () {
  "use strict";

  /* ---------- ค่าคงที่ ---------- */
  var ORDER_API_URL =
    "https://script.google.com/macros/s/AKfycbztCdQbz9w5APo-YdXf3iVFyFp4eTyGvKMcy1w0lG02Zb9uR8zr98cPLbCG0xH92uYwrw/exec";

  var ORDERS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTm3byyUHh4D0NuRQ8tiVuSKdokhDJq-juzZEg7EsBuem1tN_X-Ywfl6wAMUyVjlneVYmqGpLWJMKlX/pub?gid=0&single=true&output=csv";

  var MOODS = [
    { key: "all", label: "ทั้งหมด" },
    { key: "fresh", label: "Fresh" },
    { key: "sweet", label: "Sweet" },
    { key: "confident", label: "Confident" },
    { key: "romance", label: "Romance" }
  ];

  /* ---------- ตัวช่วย ---------- */
  function formatPrice(n) {
    return Number(n).toLocaleString("th-TH");
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  /* ==========================================================
     1) หน้า product.html
     ========================================================== */
  function initProductPage() {
    var filterBar = document.getElementById("filter-bar");
    var listEl = document.getElementById("product-list");
    if (!filterBar || !listEl) return;

    var products = [];
    var currentMood = "all";

    function buildFilterBar() {
      filterBar.innerHTML = "";
      MOODS.forEach(function (m) {
        var btn = el("button", "filter-btn");
        btn.type = "button";
        btn.dataset.mood = m.key;

        if (m.key !== "all") {
          // data-mood บน wrapper เพื่อให้ได้สีจุดของ mood นั้น
          var dotWrap = el("span", "");
          dotWrap.dataset.mood = m.key;
          dotWrap.appendChild(el("span", "mood-dot"));
          btn.appendChild(dotWrap);
        }
        btn.appendChild(document.createTextNode(m.label));

        btn.addEventListener("click", function () {
          setMood(m.key);
        });
        filterBar.appendChild(btn);
      });
    }

    function updateActiveButton() {
      var buttons = filterBar.querySelectorAll(".filter-btn");
      buttons.forEach(function (b) {
        var active = b.dataset.mood === currentMood;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }

    function buildOrderUrl(p) {
      var itemName = p.name + (p.size ? " " + p.size : "");
      return (
        "order.html?item=" +
        encodeURIComponent(itemName) +
        "&price=" +
        encodeURIComponent(p.price)
      );
    }

    function buildCard(p) {
      var card = el("article", "product-card");
      card.dataset.mood = p.mood;

      // รูป
      var media = el("div", "product-card__media");
      var img = document.createElement("img");
      img.src = p.image;
      img.alt = p.name;
      img.loading = "lazy";
      media.appendChild(img);
      card.appendChild(media);

      // เนื้อหา
      var body = el("div", "product-card__body");

      var moodRow = el("div", "product-card__mood");
      moodRow.appendChild(el("span", "mood-dot"));
      moodRow.appendChild(
        document.createTextNode(p.mood.charAt(0).toUpperCase() + p.mood.slice(1))
      );
      body.appendChild(moodRow);

      body.appendChild(el("h3", "product-card__name", p.name));
      if (p.size) {
        body.appendChild(el("div", "product-card__meta", p.size));
      }
      if (p.description) {
        body.appendChild(el("p", "product-card__desc", p.description));
      }

      // ราคา + ปุ่มสั่งซื้อ
      var footer = el("div", "product-card__footer");
      var price = el("span", "price", formatPrice(p.price));
      price.appendChild(el("small", "", "บาท"));
      footer.appendChild(price);

      var buy = el("a", "btn btn--accent btn--sm", "สั่งซื้อ");
      buy.href = buildOrderUrl(p);
      footer.appendChild(buy);

      body.appendChild(footer);
      card.appendChild(body);
      return card;
    }

    function render() {
      listEl.innerHTML = "";
      var shown = products.filter(function (p) {
        return currentMood === "all" || p.mood === currentMood;
      });

      if (!shown.length) {
        listEl.appendChild(el("p", "text-center", "ไม่พบสินค้าในหมวดนี้"));
        return;
      }
      shown.forEach(function (p) {
        listEl.appendChild(buildCard(p));
      });
    }

    function setMood(mood) {
      currentMood = mood;
      updateActiveButton();
      render();
    }

    buildFilterBar();

    fetch("products.json")
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        products = data;

        // กรองอัตโนมัติจาก ?mood=xxx
        var param = (getParam("mood") || "").toLowerCase();
        var valid = MOODS.some(function (m) {
          return m.key === param;
        });
        currentMood = valid ? param : "all";

        updateActiveButton();
        render();
      })
      .catch(function (error) {
        console.error(error);
        listEl.innerHTML = "";
        listEl.appendChild(
          el(
            "p",
            "text-center",
            "ไม่สามารถโหลดรายการสินค้าได้ กรุณาลองใหม่อีกครั้ง"
          )
        );
      });
  }

  /* ==========================================================
     2) หน้า order.html
     ========================================================== */
  function initOrderPage() {
    var form = document.getElementById("orderForm");
    if (!form) return;

    var itemsInput = document.getElementById("items");
    var totalInput = document.getElementById("total");

    // เติมค่าจาก URL ทันทีที่โหลดหน้า (ทั้ง items และ total)
    var item = getParam("item");
    var price = getParam("price");
    if (item !== null && itemsInput) itemsInput.value = item;
    if (price !== null && totalInput) totalInput.value = price;

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      var payload = {
        customerName: document.getElementById("customerName").value.trim(),
        contact: document.getElementById("contact").value.trim(),
        items: document.getElementById("items").value.trim(),
        total: document.getElementById("total").value.trim(),
        note: document.getElementById("note").value.trim()
      };

      fetch(ORDER_API_URL, {
        method: "POST",
        body: JSON.stringify(payload)
      })
        .then(() => {
          window.location.href = "thankyou.html";
        })
        .catch((error) => {
          console.error(error);
          alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  /* ==========================================================
     3) หน้า admin.html
     ========================================================== */

  // parse CSV เอง: รองรับ "..." , "" (quote ซ้อน), คอมมาและขึ้นบรรทัดใหม่ใน field
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;

    // ตัด BOM
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    for (var i = 0; i < text.length; i++) {
      var c = text[i];

      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }

    // แถวสุดท้ายที่ไม่มีขึ้นบรรทัดใหม่ปิดท้าย
    if (field !== "" || row.length) {
      row.push(field);
      rows.push(row);
    }

    // ตัดแถวว่าง
    return rows.filter(function (r) {
      return r.some(function (cell) {
        return cell.trim() !== "";
      });
    });
  }

  function initAdminPage() {
    var tbody = document.querySelector("#ordersTable tbody");
    if (!tbody) return;

    function showMessage(msg) {
      tbody.innerHTML = "";
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = 6;
      td.textContent = msg;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    showMessage("กำลังโหลดข้อมูล...");

    // เติม timestamp กันแคช เพื่อให้เห็นออเดอร์ล่าสุด
    var url = ORDERS_CSV_URL + "&t=" + Date.now();

    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text);

        // แถวแรกคือหัวตาราง
        var data = rows.slice(1);

        if (!data.length) {
          showMessage("ยังไม่มีรายการสั่งซื้อ");
          return;
        }

        // ล่าสุดขึ้นก่อน (ชีตเพิ่มแถวต่อท้ายเสมอ จึงกลับลำดับ)
        data.reverse();

        tbody.innerHTML = "";
        data.forEach(function (r) {
          var tr = document.createElement("tr");
          // คอลัมน์: วันเวลา, ชื่อลูกค้า, เบอร์โทร/Line, รายการสินค้า, จำนวนเงินรวม, หมายเหตุ
          for (var i = 0; i < 6; i++) {
            var td = document.createElement("td");
            td.textContent = r[i] !== undefined ? r[i] : "";
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        });
      })
      .catch(function (error) {
        console.error(error);
        showMessage("ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
      });
  }

  /* ---------- เริ่มทำงานตามหน้าที่เปิดอยู่ ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    initProductPage();
    initOrderPage();
    initAdminPage();
  });
})();
