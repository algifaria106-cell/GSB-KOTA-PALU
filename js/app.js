(function () {
    'use strict';

    var DATA = json_GSBKOTAPALU_1;
    var LIST_LIMIT = 150;
    var CLASSES = [
        { max: 5,        color: '#4fd1c5', label: '≤ 5 m' },
        { max: 10,       color: '#a3e635', label: '> 5 – 10 m' },
        { max: 15,       color: '#facc15', label: '> 10 – 15 m' },
        { max: 20,       color: '#fb923c', label: '> 15 – 20 m' },
        { max: Infinity, color: '#ef4444', label: '> 20 m' }
    ];

    // Data cleanup: unify inconsistent spellings from the source attribute table.
    var KEL_FIX = { 'BesusuTengah': 'Besusu Tengah' };
    DATA.features.forEach(function (f) {
        var p = f.properties;
        if (p.Kel && KEL_FIX[p.Kel]) p.Kel = KEL_FIX[p.Kel];
    });

    var state = { kec: '', kel: '', q: '', selected: null };

    function gsbClass(v) {
        for (var i = 0; i < CLASSES.length; i++) {
            if (v <= CLASSES[i].max) return i;
        }
        return CLASSES.length - 1;
    }

    function colorFor(v) {
        return v == null ? '#94a3b8' : CLASSES[gsbClass(v)].color;
    }

    function matches(p) {
        if (state.kec && p.kec !== state.kec) return false;
        if (state.kel && p.Kel !== state.kel) return false;
        if (state.q && String(p.nama_jalan || '').toLowerCase().indexOf(state.q) === -1) return false;
        return true;
    }

    function isFiltered() {
        return !!(state.kec || state.kel || state.q);
    }

    function esc(v) {
        return String(v == null ? '–' : v).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function fmt(v, unit) {
        if (v == null) return '–';
        return Number(v).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + (unit || '');
    }

    // ---------- Map ----------
    var hadHash = /^#\d/.test(location.hash);
    var map = L.map('map', { zoomControl: false, maxZoom: 22, minZoom: 10 })
        .fitBounds([[-0.9127459674975688, 119.8288690066207], [-0.8807905990887471, 119.8871122111912]]);
    new L.Hash(map);
    map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank">Leaflet</a> &middot; <a href="https://qgis.org" target="_blank">QGIS</a>');

    L.control.zoom({ position: 'topright' }).addTo(map);
    var measure = new L.Control.Measure({
        position: 'topright',
        primaryLengthUnit: 'meters',
        secondaryLengthUnit: 'kilometers',
        primaryAreaUnit: 'sqmeters',
        secondaryAreaUnit: 'hectares',
        localization: 'en'
    }).addTo(map);
    var toggle = document.querySelector('.leaflet-control-measure-toggle');
    if (toggle) {
        toggle.innerHTML = '';
        toggle.className += ' fas fa-ruler';
        toggle.title = 'Ukur jarak & luas';
    }

    var basemaps = {
        'Citra Satelit': L.tileLayer('https://mt0.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}', {
            maxZoom: 22, maxNativeZoom: 20, attribution: 'Imagery &copy; Google'
        }),
        'Satelit + Label': L.tileLayer('https://mt0.google.com/vt/lyrs=y&hl=id&x={x}&y={y}&z={z}', {
            maxZoom: 22, maxNativeZoom: 20, attribution: 'Imagery &copy; Google'
        }),
        'Peta Jalan': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 22, maxNativeZoom: 19, attribution: '&copy; OpenStreetMap contributors'
        }),
        'Peta Gelap': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 22, maxNativeZoom: 20, subdomains: 'abcd',
            attribution: '&copy; OpenStreetMap &copy; CARTO'
        })
    };
    basemaps['Citra Satelit'].addTo(map);

    function roadStyle(feature) {
        var p = feature.properties;
        if (state.selected && p.nama_jalan === state.selected && matches(p)) {
            return { color: '#ffffff', weight: 7, opacity: 1, lineCap: 'round' };
        }
        if (!matches(p)) {
            return { color: '#cbd5e1', weight: 1.5, opacity: isFiltered() ? 0.25 : 1, lineCap: 'round' };
        }
        return { color: colorFor(p.pene_gsb), weight: isFiltered() ? 4.5 : 3, opacity: 1, lineCap: 'round' };
    }

    function popupHtml(p) {
        return '' +
            '<div class="pop-head"><small>' + esc(p.Kel) + ', ' + esc(p.kec) + '</small>' +
            '<strong>' + esc(p.nama_jalan || 'Tanpa nama') + '</strong></div>' +
            '<div class="pop-gsb"><b style="color:' + colorFor(p.pene_gsb) + '">' + fmt(p.pene_gsb) + '</b>' +
            '<span>meter<br>Penetapan GSB</span></div>' +
            '<table class="pop-table">' +
            '<tr><th>R rata-rata</th><td>' + fmt(p.R_rata_rat, ' m') + '</td></tr>' +
            '<tr><th>Jarak bangunan</th><td>' + fmt(p.Jr_Bang_pa, ' m') + '</td></tr>' +
            '<tr><th>Kecamatan</th><td>' + esc(p.kec) + '</td></tr>' +
            '<tr><th>Kelurahan</th><td>' + esc(p.Kel) + '</td></tr>' +
            '</table>';
    }

    var roads = L.geoJson(DATA, {
        style: roadStyle,
        onEachFeature: function (feature, layer) {
            layer.bindPopup(popupHtml(feature.properties), { maxWidth: 300 });
            layer.on({
                mouseover: function (e) {
                    e.target.setStyle({ weight: 7, color: '#ffffff' });
                    e.target.bringToFront();
                },
                mouseout: function (e) { roads.resetStyle(e.target); }
            });
        }
    }).addTo(map);

    if (!hadHash) map.fitBounds(roads.getBounds(), { padding: [20, 20] });

    L.control.layers(basemaps, { 'Garis Sempadan Bangunan': roads }, { position: 'topright' }).addTo(map);

    // ---------- Panel ----------
    var $ = function (id) { return document.getElementById(id); };
    var elKec = $('f-kec'), elKel = $('f-kel'), elQ = $('f-q');

    var byKec = {};
    DATA.features.forEach(function (f) {
        var p = f.properties;
        if (!p.kec) return;
        byKec[p.kec] = byKec[p.kec] || {};
        if (p.Kel) byKec[p.kec][p.Kel] = true;
    });

    Object.keys(byKec).sort().forEach(function (k) {
        elKec.add(new Option(k, k));
    });

    function fillKel() {
        elKel.length = 1;
        var kels = state.kec ? Object.keys(byKec[state.kec]) : [];
        kels.sort().forEach(function (k) { elKel.add(new Option(k, k)); });
        elKel.disabled = !state.kec;
    }

    function filteredFeatures() {
        return DATA.features.filter(function (f) { return matches(f.properties); });
    }

    function renderLegend(feats) {
        var counts = CLASSES.map(function () { return 0; });
        feats.forEach(function (f) {
            if (f.properties.pene_gsb != null) counts[gsbClass(f.properties.pene_gsb)]++;
        });
        $('legend').innerHTML = CLASSES.map(function (c, i) {
            return '<div class="legend-row"><span class="legend-swatch" style="background:' + c.color + '"></span>' +
                c.label + '<span class="count">' + counts[i].toLocaleString('id-ID') + '</span></div>';
        }).join('');
    }

    function renderStats(feats, names) {
        var sum = 0, n = 0;
        feats.forEach(function (f) {
            if (f.properties.pene_gsb != null) { sum += f.properties.pene_gsb; n++; }
        });
        $('s-seg').textContent = feats.length.toLocaleString('id-ID');
        $('s-names').textContent = names.length.toLocaleString('id-ID');
        $('s-avg').textContent = n ? fmt(sum / n) : '–';
    }

    function renderList(names, groups) {
        var list = $('road-list');
        $('list-count').textContent = names.length.toLocaleString('id-ID') + ' jalan';
        if (!names.length) {
            list.innerHTML = '<li class="empty">Tidak ada jalan yang cocok dengan filter.</li>';
            $('list-more').textContent = '';
            return;
        }
        list.innerHTML = names.slice(0, LIST_LIMIT).map(function (name) {
            var g = groups[name];
            return '<li><button type="button" data-name="' + esc(name) + '"' +
                (name === state.selected ? ' class="active"' : '') + '>' +
                '<span class="dot" style="background:' + colorFor(g.gsb) + '"></span>' +
                '<span class="name">' + esc(name) + '</span>' +
                '<span class="meta">GSB ' + fmt(g.gsb) + ' m</span></button></li>';
        }).join('');
        $('list-more').textContent = names.length > LIST_LIMIT
            ? 'Menampilkan ' + LIST_LIMIT + ' dari ' + names.length + ' jalan — persempit filter atau cari nama jalan.'
            : '';
    }

    function update(fit) {
        var feats = filteredFeatures();
        var groups = {};
        feats.forEach(function (f) {
            var name = f.properties.nama_jalan;
            if (!name) return;
            var g = groups[name] = groups[name] || { gsb: null };
            if (f.properties.pene_gsb != null && (g.gsb == null || f.properties.pene_gsb > g.gsb)) {
                g.gsb = f.properties.pene_gsb;
            }
        });
        var names = Object.keys(groups).sort(function (a, b) { return a.localeCompare(b, 'id'); });
        if (state.selected && !groups[state.selected]) state.selected = null;

        roads.setStyle(roadStyle);
        roads.eachLayer(function (l) { if (matches(l.feature.properties)) l.bringToFront(); });

        renderStats(feats, names);
        renderLegend(feats);
        renderList(names, groups);

        if (fit && feats.length && isFiltered()) {
            map.fitBounds(L.geoJson({ type: 'FeatureCollection', features: feats }).getBounds(), { padding: [40, 40] });
        }
    }

    function selectRoad(name) {
        state.selected = name;
        update(false);
        var layers = [];
        roads.eachLayer(function (l) {
            var p = l.feature.properties;
            if (p.nama_jalan === name && matches(p)) { layers.push(l); l.bringToFront(); }
        });
        if (!layers.length) return;
        var group = L.featureGroup(layers);
        map.fitBounds(group.getBounds(), { padding: [60, 60], maxZoom: 18 });
        layers[0].openPopup(group.getBounds().getCenter());
        if (window.matchMedia('(max-width: 760px)').matches) document.body.classList.remove('panel-open');
    }

    elKec.addEventListener('change', function () {
        state.kec = elKec.value;
        state.kel = '';
        state.selected = null;
        fillKel();
        update(true);
    });

    elKel.addEventListener('change', function () {
        state.kel = elKel.value;
        state.selected = null;
        update(true);
    });

    var qTimer;
    elQ.addEventListener('input', function () {
        clearTimeout(qTimer);
        qTimer = setTimeout(function () {
            state.q = elQ.value.trim().toLowerCase();
            update(false);
        }, 180);
    });

    $('road-list').addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-name]');
        if (btn) selectRoad(btn.getAttribute('data-name'));
    });

    $('f-reset').addEventListener('click', function () {
        state = { kec: '', kel: '', q: '', selected: null };
        elKec.value = '';
        elQ.value = '';
        fillKel();
        update(false);
        map.fitBounds(roads.getBounds(), { padding: [20, 20] });
    });

    $('panel-toggle').addEventListener('click', function () {
        document.body.classList.toggle('panel-open');
    });

    fillKel();
    update(false);
})();
