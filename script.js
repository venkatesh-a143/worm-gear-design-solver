const mat_db = {
    "1":  ["Cast Iron Grade 20", 47.1, 200],
    "2":  ["Cast Iron Grade 25", 56.4, 220],
    "3":  ["Cast Iron Grade 35", 56.4, 225],
    "4":  ["Cast Iron Grade 35 (Heat treated)", 78.5, 300],
    "5":  ["Cast steel, 0.20%C, untreated", 138.3, 180],
    "6":  ["Cast steel, 0.20%C, heat treated", 193.2, 250],
    "7":  ["Bronze", 68.7, 80],
    "8":  ["Phosphor gear bronze", 82.4, 100],
    "9":  ["Manganese bronze", 138.3, 100],
    "10": ["Aluminium bronze", 152.0, 180],
    "11": ["Forged steel, about 0.30%C (untreated)", 172.6, 150],
    "12": ["Forged steel, about 0.30%C (heat treated)", 220.0, 200],
    "13": ["Steel, C30 (heat treated)", 220.6, 300],
    "14": ["Steel, C40, untreated", 207.0, 150],
    "15": ["Steel, C45, untreated", 233.4, 200],
    "16": ["Alloy steel, case hardened", 345.2, 650],
    "17": ["Cr-Ni Steel, about 0.45%C, heat treated", 462.0, 400],
    "18": ["Cr-Va steel, about 0.45%C, heat treated", 516.8, 450],
    "19": ["Rawhide, Fabroil, etc.", 41.2, null],
    "20": ["Plastic", 58.8, null],
    "21": ["Laminated phenolic materials (Bakelite, Micarta, Celoron)", 41.2, null],
    "22": ["Laminated steel (silent material)", 82.4, null],
    "23": ["Manual Input", null, null]
};

const std_modules = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 25, 32, 40];

// Populate material dropdowns and table
for (let i = 1; i <= 23; ++i) {
    const [mat, sd, bhn] = mat_db[String(i)];
    let opttxt = i == 23
        ? 'Manual Input'
        : `${mat} (σd=${sd}${sd ? ' MPa' : ''}, BHN=${bhn ?? '-'})`;
    let opt = new Option(opttxt, String(i));
    document.getElementById('worm_mat_choice').add(opt.cloneNode(true));
    document.getElementById('gear_mat_choice').add(opt.cloneNode(true));
    if (i != 23) {
        document.querySelector('.mat-table').innerHTML +=
            `<tr><td>${i}</td><td>${mat}</td><td>${sd ?? '-'}</td><td>${bhn ?? '-'}</td></tr>`;
    }
}

document.getElementById('worm_mat_choice').value = "8";
document.getElementById('gear_mat_choice').value = "8";

document.getElementById('worm_mat_choice').onchange = e => {
    document.getElementById('worm_manual').style.display = e.target.value == "23" ? 'inline' : 'none';
};
document.getElementById('gear_mat_choice').onchange = e => {
    document.getElementById('gear_manual').style.display = e.target.value == "23" ? 'inline' : 'none';
};

function getNum(id) {
    var v = document.getElementById(id).value.trim();
    let val = v === "" ? null : parseFloat(v);
    return isNaN(val) ? null : val;
}

function round_up_5(x) {
    return 5 * Math.ceil(x / 5.0);
}

function solve() {
    // INPUTS
    let drive = document.getElementById('drive').value || 'worm';
    let z1 = getNum("z1") || 2;
    let z2 = getNum("z2");
    let i_val = getNum("i_val");
    let N1 = getNum("N1");
    let N2 = getNum("N2");
    let a_input = getNum("a_input");
    let d1_input = getNum("d1_input");
    let d2_input = getNum("d2_input");
    let m_input = getNum("m_input");
    let P = getNum("P") || 0;
    let pa_choice = document.getElementById("pa_choice").value;
    let phi = pa_choice == "2" ? 14.5 : (pa_choice == "1" || pa_choice == "3" ? 20.0 : null);
    let mu_input = getNum("mu_input");

    // Materials
    let worm_mat_choice = document.getElementById('worm_mat_choice').value;
    let worm_mat_name, sigma_d1, bhn1;
    if (worm_mat_choice !== "23") {
        [worm_mat_name, sigma_d1, bhn1] = mat_db[worm_mat_choice];
    } else {
        worm_mat_name = "Custom Worm";
        sigma_d1 = getNum("sigma_d1");
        bhn1 = getNum("bhn1");
        if (sigma_d1 && !bhn1) bhn1 = sigma_d1 / 0.6;
        if (bhn1 && !sigma_d1) sigma_d1 = bhn1 * 0.33;
    }

    let gear_mat_choice = document.getElementById('gear_mat_choice').value;
    let gear_mat_name, sigma_d2, bhn2;
    if (gear_mat_choice !== "23") {
        [gear_mat_name, sigma_d2, bhn2] = mat_db[gear_mat_choice];
    } else {
        gear_mat_name = "Custom Gear";
        sigma_d2 = getNum("sigma_d2");
        bhn2 = getNum("bhn2");
        if (sigma_d2 && !bhn2) bhn2 = sigma_d2 / 0.6;
        if (bhn2 && !sigma_d2) sigma_d2 = bhn2 * 0.33;
    }

    let mat_name = `${worm_mat_name} / ${gear_mat_name}`;
    let sigma_d = Math.min(sigma_d1 || 80, sigma_d2 || 80);
    let avg_bhn = ((bhn1 || 100) + (bhn2 || 100)) / 2;
    let K = getNum("K") || 0.549;
    let y = 0.1;

    // SPEED RATIO
    let i = i_val || (z2 && z1 ? z2 / z1 : null);
    if (N2 == null && N1 && i) N2 = N1 / i;
    if (N1 == null && N2 && i) N1 = N2 * i;
    if (z2 == null && i && z1) z2 = Math.round(i * z1);
    let n1 = N1 / 60, n2 = N2 / 60;

    // GEOMETRY
    let d1_user_locked = d1_input !== null;
    let d2_user_locked = d2_input !== null;
    let a_user_locked = a_input !== null;
    let d1, d2, a;

    if (a_input !== null && d1_input === null && d2_input === null) {
        a = round_up_5(a_input);
        d1 = round_up_5(Math.pow(a, 0.875) / 1.466);
        d2 = round_up_5(2 * a - d1);
    } else if (d1_input !== null && m_input !== null) {
        d1 = round_up_5(d1_input);
        d2 = round_up_5(m_input * z2);
        a = round_up_5((d1 + d2) / 2);
    } else if (d2_input !== null && m_input !== null) {
        d2 = round_up_5(d2_input);
        d1 = round_up_5(m_input * z1);
        a = round_up_5((d1 + d2) / 2);
    } else if (d1_input !== null && d2_input !== null) {
        d1 = round_up_5(d1_input);
        d2 = round_up_5(d2_input);
        a = round_up_5((d1 + d2) / 2);
    } else {
        a = round_up_5((P > 0 && i !== null) ? Math.pow((P * (i + 5)) / 0.02905, 1 / 1.7) : 50);
        d1 = round_up_5(Math.pow(a, 0.875) / 1.466);
        d2 = round_up_5(2 * a - d1);
    }

    let b = round_up_5(Math.pow(a, 0.875) / 2);

    // MODULE CALCULATION
    let gamma_w_rad = Math.atan((1.0 * z1) / d1);
    let v = (Math.PI * d2 * N2) / 60000;
    let Cv = 6.1 / (6.1 + v);
    let Mt = P * 1000 * 60 / (2 * Math.PI * N2);
    let Ft = 2 * Mt / (d2 / 1000);
    let m = m_input, m_theoretical = null;
    let user_locked_module = m_input !== null;

    if (m_input === null) {
        m_theoretical = Ft / (sigma_d * b * y * Math.PI * Cv);
        let m_candidates = std_modules.filter(mm => mm >= m_theoretical);
        m = m_candidates.length ? m_candidates[0] : std_modules[std_modules.length - 1];
    }

    // STRENGTH CHECK
    let idx = std_modules.indexOf(m);
    let looped = false;
    let gamma_w_deg, gamma_g_rad, gamma_g_deg, vr, mu, Fs, Fw;

    while (true) {
        gamma_w_rad = Math.atan((m * z1) / d1);
        gamma_g_rad = Math.atan((m * z2) / d2);
        gamma_w_deg = gamma_w_rad * 180 / Math.PI;
        gamma_g_deg = gamma_g_rad * 180 / Math.PI;
        if (phi == null) phi = 20.0;

        vr = (Math.PI * d1 * N1) / (60 * 1000 * Math.cos(gamma_w_rad));

        if (mu_input !== null) mu = mu_input;
        else mu = vr <= 2.8 ? 0.0422 / Math.pow(vr, 0.28) : 0.025 + (3.281 * vr) / 1000;

        Fs = sigma_d * b * y * Math.PI * m;
        Fw = d2 * b * K;

        if (Fw >= Fs) break;
        if (user_locked_module) break;
        if (idx >= std_modules.length - 1) break;
        m = std_modules[++idx];
        looped = true;
    }

    // EFFICIENCY & THERMAL
    let tan_gamma = Math.tan(gamma_w_rad);
    let cot_gamma = 1 / tan_gamma;
    let cos_gamma = Math.cos(gamma_w_rad);
    let theta_rad = Math.atan(tan_gamma * cos_gamma);
    let cos_theta = Math.cos(theta_rad);
    let eta;

    if (drive === "worm")
        eta = (cos_theta - mu * tan_gamma) / (cos_theta + mu * cot_gamma);
    else
        eta = (cos_theta - mu * cot_gamma) / (cos_theta + mu * tan_gamma);

    let Fn = Ft / (cos_theta * cos_gamma);
    let Qg = mu * Fn * vr / cos_gamma;
    let Qd = 1000 * P * (1 - eta);

    // FORCE COMPONENTS (Fx, Fy, Fz)
    let theta = phi * Math.PI / 180, gamma = gamma_w_rad, mu_val = mu;
    let Q_ = Ft * (Math.cos(theta) * Math.sin(gamma) + mu_val * Math.cos(gamma)) /
              (Math.cos(theta) * Math.cos(gamma) - mu_val * Math.sin(gamma));
    let R_ = Ft * Math.sin(theta) /
              (Math.cos(theta) * Math.cos(gamma) - mu_val * Math.sin(gamma));
    let Fx_worm = Q_, Fy_worm = R_, Fz_worm = Ft;
    let Fx_gear = Ft, Fy_gear = R_, Fz_gear = Q_;

    // RESULTS OUTPUT
    let res = `<h2>🛠️ FINAL DESIGN RESULTS</h2>
<b>Material:</b> ${mat_name}<br>
<b>Power:</b> ${P} kW<br>
<b>Velocity Ratio i:</b> ${i ? i.toFixed(3) : 'n/a'}<br>
<h4>Speeds</h4>
Input Speed N1: ${N1 || '-'} rpm<br>
Output Speed N2: ${N2?.toFixed(2) || '-'} rpm<br>
Worm speed n1: ${n1?.toFixed(4) || '-'} rps<br>
Worm wheel speed n2: ${n2?.toFixed(4) || '-'} rps<br>
<h4>Geometry</h4>
Center Distance a: ${a} mm<br>
Worm Diameter d1: ${d1} mm<br>
Gear Diameter d2: ${d2} mm<br>
Face Width b: ${b} mm<br>
<h4>Module</h4>`;

    if (m_theoretical === null)
        res += `User Given Module m: ${m}`;
    else
        res += `Theoretical Module m_th: <b>${m_theoretical.toFixed(4)}</b><br>
Selected Standard Module m: <b>${m}</b>`;

    res += `
<h4>Angles</h4>
Lead Angle (Worm): ${gamma_w_deg?.toFixed(3) || '-'} deg<br>
Lead Angle (Gear): ${gamma_g_deg?.toFixed(3) || '-'} deg<br>
Pressure Angle φ: ${phi?.toFixed(3) || '-'} deg<br>
<h4>Velocities</h4>
Pitch Line Velocity v: ${v?.toFixed(5) || '-'} m/s<br>
Relative Velocity vr: ${vr?.toFixed(5) || '-'} m/s<br>
<h4>Forces</h4>
Tangential Load Ft: ${Ft?.toFixed(2) || '-'} N<br>
Beam Strength Fs: ${Fs?.toFixed(2) || '-'} N<br>
Wear Load Fw: ${Fw?.toFixed(2) || '-'} N<br>
<h4>Friction & Efficiency</h4>
Velocity Factor Cv: ${Cv?.toFixed(4) || '-'}<br>
Friction μ: ${mu?.toFixed(5) || '-'}<br>
Efficiency η: ${(eta * 100)?.toFixed(2) || '-'} %<br>
<h4>Thermal</h4>
Heat Generated Qg: ${Qg?.toFixed(2) || '-'} W<br>
Heat Dissipated Qd: ${Qd?.toFixed(2) || '-'} W<br>
${Qd < Qg ? '<div class="warn">⚠ Artificial cooling required</div>' : ''}
<h4>Force Components (Design Data Handbook)</h4>
Worm Axial Thrust Fx_worm: ${Fx_worm?.toFixed(2) || '-'} N<br>
Worm Radial Force Fy_worm: ${Fy_worm?.toFixed(2) || '-'} N<br>
Worm Tangential Force Fz_worm: ${Fz_worm?.toFixed(2) || '-'} N<br>
Gear Tangential Force Fx_gear: ${Fx_gear?.toFixed(2) || '-'} N<br>
Gear Radial Force Fy_gear: ${Fy_gear?.toFixed(2) || '-'} N<br>
Gear Axial Thrust Fz_gear: ${Fz_gear?.toFixed(2) || '-'} N<br>
<h3 style="color:#189b3c;margin-top:16px;">✅ DESIGN COMPLETE</h3>`;

    if (looped && user_locked_module)
        res += `<div class="warn">⚠ WARNING: User module is NOT safe (Fw < Fs)</div>`;

    document.getElementById('results').innerHTML = res;
    document.getElementById('results').style.display = '';
}
