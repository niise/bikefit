import React, { useState, useEffect } from 'react';

// --- Default Data ---
const defaultGeom = {
    reach: 383, stack: 545, htAngle: 73.0, stAngle: 73.0, bbDrop: 68, wheelbase: 976,
    chainstay: 405, htLength: 148, stLength: 470, wheelRadius: 341,
    crankLength_before: 170, seatpostLength_before: 205, saddleSetback_before: 0, saddleTilt_before: 0,
    crankLength_after: 165, seatpostLength_after: 210, saddleSetback_after: -30, saddleTilt_after: -2,
    spacerHeight_before: 20, stemLength_before: 90, stemAngle_before: 8,
    spacerHeight_after: 20, stemLength_after: 110, stemAngle_after: -8,
    riderInseam: 800, riderSternalNotch: 1410, riderArm: 564, riderLowerLeg: 445,
    riderFoot: 100, riderAnkleFlex: 0, riderFlexibility: 2, riderCore: 2, ridingStyle: 'all_rounder'
};

// --- Helper Functions ---
const degToRad = (deg) => deg * (Math.PI / 180);
const radToDeg = (rad) => rad * (180 / Math.PI);
const getDistance = (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

const getAngle = (p1, p2, p3) => {
    if (!p1 || !p2 || !p3) return 0;
    const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
    const dotProduct = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    if (mag1 === 0 || mag2 === 0) return 0;
    const cosTheta = dotProduct / (mag1 * mag2);
    return radToDeg(Math.acos(Math.max(-1, Math.min(1, cosTheta))));
};

const getHorizontalAngle = (p1, p2) => {
    if (!p1 || !p2) return 0;
    return radToDeg(Math.atan2(-(p2.y - p1.y), p2.x - p1.x));
};

function intersectCircles(p0, r0, p1, r1) {
    const d = getDistance(p0, p1);
    if (d > r0 + r1 || d < Math.abs(r0 - r1) || d === 0) return null;
    const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, r0 * r0 - a * a));
    const x2 = p0.x + a * (p1.x - p0.x) / d;
    const y2 = p0.y + a * (p1.y - p0.y) / d;
    const pa = { x: x2 + h * (p1.y - p0.y) / d, y: y2 - h * (p1.x - p0.x) / d };
    const pb = { x: x2 - h * (p1.y - p0.y) / d, y: y2 + h * (p1.x - p0.x) / d };
    return pa.y < pb.y ? pa : pb;
}

function App() {
    const [bikeGeom, setBikeGeom] = useState(defaultGeom);
    const [points, setPoints] = useState(null);
    const [angles, setAngles] = useState({});
    const [modal, setModal] = useState({ show: false, title: '', content: '' });

    const handleInputChange = (e) => {
        const { dataset: { key }, value } = e.target;
        if (key) {
            setBikeGeom(prev => ({ ...prev, [key]: key === 'ridingStyle' ? value : parseFloat(value) || 0 }));
        }
    };

    const handleSuggestFit = async () => {
        setModal({ show: true, title: 'AI Suggestion', content: 'AI is calculating the best fit for you...' });
        const suggestedFit = await callGemini("suggest", "", true);
        if(suggestedFit) {
            setBikeGeom(prev => ({...prev, ...suggestedFit}));
        }
    };

    const handleAnalyzeFit = async () => {
        setModal({ show: true, title: 'AI Analysis', content: 'AI is analyzing your fit...' });
        const analysis = await callGemini("analyze", "");
        setModal({ show: true, title: 'AI Analysis', content: analysis });
    };

    async function callGemini(prompt, systemInstruction, isJson = false) {
        const API_KEY = ""; // Provided by the environment
        const API_URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=";
        const GEMINI_API_URL = `${API_URL_BASE}${API_KEY}`;

        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: {}
        };

        if (isJson) {
            payload.generationConfig.responseMimeType = "application/json";
        }

        try {
            const response = await fetch(GEMINI_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            const candidate = result.candidates?.[0];

            if (candidate && candidate.content?.parts?.[0]?.text) {
                return isJson ? JSON.parse(candidate.content.parts[0].text) : candidate.content.parts[0].text;
            } else {
                throw new Error("Invalid response format from AI.");
            }
        } catch (error) {
            console.error("Gemini API call failed:", error);
            throw new Error(`Gemini API call failed: ${error.message}`);
        }
    }

    useEffect(() => {
        const geom = bikeGeom;
        const calculatedRiderTorso = Math.max(100, geom.riderSternalNotch - geom.riderInseam);
        const calculatedRiderThigh = Math.max(100, geom.riderInseam * 0.41);
        const htAngleRad = degToRad(geom.htAngle);
        const stAngleRad = degToRad(geom.stAngle);
        const bb = { x: 0, y: 0 };
        const htTop = { x: geom.reach, y: -geom.stack };
        const stTop = { x: -(geom.stLength * Math.cos(stAngleRad)), y: -(geom.stLength * Math.sin(stAngleRad)) };
        const htBot = { x: htTop.x + geom.htLength * Math.cos(htAngleRad), y: htTop.y + geom.htLength * Math.sin(htAngleRad) };
        const rearAxle_Y = -geom.bbDrop;
        const rearAxle_X_Sq = Math.pow(geom.chainstay, 2) - Math.pow(rearAxle_Y - bb.y, 2);
        const rearAxle = { x: rearAxle_X_Sq > 0 ? -Math.sqrt(rearAxle_X_Sq) : 0, y: rearAxle_Y };
        const frontAxle = { x: rearAxle.x + geom.wheelbase, y: rearAxle_Y };

        const processFit = (type) => {
            const suffix = `_${type}`;
            const spacerTop = { x: htTop.x - geom[`spacerHeight${suffix}`] * Math.cos(htAngleRad), y: htTop.y - geom[`spacerHeight${suffix}`] * Math.sin(htAngleRad) };
            const stemAngleRad = (degToRad(90)) - htAngleRad + degToRad(geom[`stemAngle${suffix}`]);
            const stemEnd = { x: spacerTop.x + geom[`stemLength${suffix}`] * Math.cos(stemAngleRad), y: spacerTop.y - geom[`stemLength${suffix}`] * Math.sin(stemAngleRad) };
            const saddleTiltRad = degToRad(geom[`saddleTilt${suffix}`]);
            const seatpostTop = { x: stTop.x - geom[`seatpostLength${suffix}`] * Math.cos(stAngleRad), y: stTop.y - geom[`seatpostLength${suffix}`] * Math.sin(stAngleRad) };
            const hip = { x: seatpostTop.x - geom[`saddleSetback${suffix}`], y: seatpostTop.y };
            const SADDLE_HALF_LENGTH = 135;
            const saddleNose = { x: hip.x + SADDLE_HALF_LENGTH * Math.cos(saddleTiltRad), y: hip.y - SADDLE_HALF_LENGTH * Math.sin(saddleTiltRad) };
            const saddleRear = { x: hip.x - SADDLE_HALF_LENGTH * Math.cos(saddleTiltRad), y: hip.y + SADDLE_HALF_LENGTH * Math.sin(saddleTiltRad) };
            const pedal = { x: geom[`crankLength${suffix}`], y: 0 };
            const shoulder = intersectCircles(hip, calculatedRiderTorso, stemEnd, geom.riderArm) || stemEnd;
            const ankleFlexRad = degToRad(geom.riderAnkleFlex);
            const ankle = { x: pedal.x - geom.riderFoot * Math.cos(ankleFlexRad), y: pedal.y + geom.riderFoot * Math.sin(ankleFlexRad) };
            const knee = intersectCircles(hip, calculatedRiderThigh, ankle, geom.riderLowerLeg) || ankle;

            const pedal_bottom = { x: 0, y: geom[`crankLength${suffix}`] };
            const ankleFlexBottomRad = degToRad(-15);
            const ankle_bottom = { x: pedal_bottom.x - geom.riderFoot * Math.cos(ankleFlexBottomRad), y: pedal_bottom.y + geom.riderFoot * Math.sin(ankleFlexBottomRad) };
            const knee_bottom = intersectCircles(hip, calculatedRiderThigh, ankle_bottom, geom.riderLowerLeg) || ankle_bottom;

            const pedal_top = { x: 0, y: -geom[`crankLength${suffix}`] };
            const ankleFlexTopRad = degToRad(0);
            const ankle_top = { x: pedal_top.x - geom.riderFoot * Math.cos(ankleFlexTopRad), y: pedal_top.y + geom.riderFoot * Math.sin(ankleFlexTopRad) };
            const knee_top = intersectCircles(hip, calculatedRiderThigh, ankle_top, geom.riderLowerLeg) || ankle_top;

            return { spacerTop, stemEnd, seatpostTop, hip, saddleNose, saddleRear, pedal, shoulder, ankle, knee, pedal_bottom, ankle_bottom, knee_bottom, pedal_top, ankle_top, knee_top };
        };

        const before = processFit('before');
        const after = processFit('after');

        setPoints({ bb, htTop, htBot, stTop, rearAxle, frontAxle, before, after });

        setAngles({
            distSaddleBbBefore: getDistance(bb, before.hip),
            riderReachBefore: before.stemEnd.x,
            riderStackBefore: -before.stemEnd.y,
            knee6Before: getAngle(before.hip, before.knee_bottom, before.ankle_bottom),
            knee12Before: getAngle(before.hip, before.knee_top, before.ankle_top),
            torso6Before: getHorizontalAngle(before.hip, before.shoulder),
            thigh6Before: getHorizontalAngle(before.hip, before.knee_bottom),

            distSaddleBbAfter: getDistance(bb, after.hip),
            riderReachAfter: after.stemEnd.x,
            riderStackAfter: -after.stemEnd.y,
            knee6After: getAngle(after.hip, after.knee_bottom, after.ankle_bottom),
            knee12After: getAngle(after.hip, after.knee_top, after.ankle_top),
            torso6After: getHorizontalAngle(after.hip, after.shoulder),
            thigh6After: getHorizontalAngle(after.hip, after.knee_bottom)
        });

    }, [bikeGeom]);

    const renderInput = (label, key, unit, props = {}) => (
        <div className="input-group">
            <label htmlFor={key}>{label}</label>
            <div className="data-input-group">
                <input type="number" id={key} data-key={key} value={bikeGeom[key]} onChange={handleInputChange} {...props} />
                <span className="input-unit">{unit}</span>
            </div>
        </div>
    );

    const renderSelect = (label, key, options) => (
        <div className="input-group mt-3">
            <label htmlFor={key}>{label}</label>
            <select id={key} data-key={key} value={bikeGeom[key]} onChange={handleInputChange} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5">
                {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
        </div>
    );

    return (
        <div className="container mx-auto max-w-7xl p-4">
            <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">自行車 Fitting 動態可視化 (✨ AI 版)</h1>
            <div className="flex flex-col md:flex-row md:gap-6">
                <div className="w-full md:w-1/3 mb-4 md:mb-0">
                    <form id="bike-form" className="bg-white p-4 rounded-lg shadow-lg space-y-4">
                        {/* Frame Geometry */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2 border-b pb-1">1. 車架幾何 (M 號)</h3>
                            <div className="grid grid-cols-2 gap-x-4">
                                <div>
                                    {renderInput("Reach", "reach", "mm", { step: 1 })}
                                    {renderInput("HT Angle", "htAngle", "°", { step: 0.1 })}
                                    {renderInput("BB Drop", "bbDrop", "mm", { step: 1 })}
                                    {renderInput("Chainstay", "chainstay", "mm", { step: 1 })}
                                    {renderInput("ST Length", "stLength", "mm", { step: 1 })}
                                </div>
                                <div>
                                    {renderInput("Stack", "stack", "mm", { step: 1 })}
                                    {renderInput("ST Angle", "stAngle", "°", { step: 0.1 })}
                                    {renderInput("Wheelbase", "wheelbase", "mm", { step: 1 })}
                                    {renderInput("HT Length", "htLength", "mm", { step: 1 })}
                                    {renderInput("Wheel Radius", "wheelRadius", "mm", { step: 1 })}
                                </div>
                            </div>
                        </div>

                        {/* Saddle Fit */}
                        <div className="form-section-divider">
                            <h3 className="text-lg font-semibold text-gray-800 mb-2 border-b pb-1">2. 座艙設定</h3>
                            <div className="grid grid-cols-2 gap-x-4">
                                <div>
                                    <h4 className="text-md font-semibold text-green-600 mb-1">調整前</h4>
                                    {renderInput("Crank", "crankLength_before", "mm", { step: 1 })}
                                    {renderInput("座管長度", "seatpostLength_before", "mm", { step: 1 })}
                                    {renderInput("坐墊後移", "saddleSetback_before", "mm", { step: 1 })}
                                    {renderInput("坐墊傾斜", "saddleTilt_before", "°", { step: 1 })}
                                </div>
                                <div>
                                    <h4 className="text-md font-semibold text-purple-600 mb-1">調整後</h4>
                                    {renderInput("Crank", "crankLength_after", "mm", { step: 1 })}
                                    {renderInput("座管長度", "seatpostLength_after", "mm", { step: 1 })}
                                    {renderInput("坐墊後移", "saddleSetback_after", "mm", { step: 1 })}
                                    {renderInput("坐墊傾斜", "saddleTilt_after", "°", { step: 1 })}
                                </div>
                            </div>
                        </div>

                        {/* Cockpit Fit */}
                        <div className="form-section-divider">
                            <h3 className="text-lg font-semibold text-gray-800 mb-2 border-b pb-1">3. 龍頭設定</h3>
                            <div className="grid grid-cols-2 gap-x-4">
                                <div>
                                    <h4 className="text-md font-semibold text-green-600 mb-1">調整前</h4>
                                    {renderInput("Spacer", "spacerHeight_before", "mm", { step: 1 })}
                                    {renderInput("Stem", "stemLength_before", "mm", { step: 1 })}
                                    {renderInput("Angle", "stemAngle_before", "°", { step: 1 })}
                                </div>
                                <div>
                                    <h4 className="text-md font-semibold text-purple-600 mb-1">調整後</h4>
                                    {renderInput("Spacer", "spacerHeight_after", "mm", { step: 1 })}
                                    {renderInput("Stem", "stemLength_after", "mm", { step: 1 })}
                                    {renderInput("Angle", "stemAngle_after", "°", { step: 1 })}
                                </div>
                            </div>
                        </div>

                        {/* Rider Data & AI */}
                        <div className="form-section-divider">
                            <h3 className="text-lg font-semibold text-gray-800 mb-2 border-b pb-1">4. 騎士數據 & AI 建議</h3>
                            <div className="grid grid-cols-2 gap-x-4">
                                <div>
                                    {renderInput("跨下長", "riderInseam", "mm", { step: 1 })}
                                    {renderInput("肩膀到手握點", "riderArm", "mm", { step: 1 })}
                                    {renderInput("腳踝到踏板", "riderFoot", "mm", { step: 1 })}
                                </div>
                                <div>
                                    {renderInput("胸骨上凹高度", "riderSternalNotch", "mm", { step: 1 })}
                                    {renderInput("小腿長", "riderLowerLeg", "mm", { step: 1 })}
                                    {renderInput("腳踝角度", "riderAnkleFlex", "°", { step: 1 })}
                                </div>
                            </div>
                            {renderSelect("腿後側柔韌度", "riderFlexibility", [{ value: 1, label: "差 (Poor)" }, { value: 2, label: "一般 (Average)" }, { value: 3, label: "良好 (Good)" }])}
                            {renderSelect("核心力量", "riderCore", [{ value: 1, label: "弱 (Weak)" }, { value: 2, label: "一般 (Average)" }, { value: 3, label: "強 (Strong)" }])}
                            {renderSelect("騎乘目標", "ridingStyle", [{ value: "comfort_endurance", label: "舒適耐力 (Endurance)" }, { value: "all_rounder", label: "全能平衡 (All-Round)" }, { value: "racing_aero", label: "競賽空力 (Racing/Aero)" }])}
                            <button type="button" onClick={handleSuggestFit} className="ai-button">✨ AI 建議「調整後」設定</button>
                        </div>
                    </form>
                </div>
                <div className="w-full md:w-2/3">
                    <div className="bg-white rounded-lg shadow-lg p-2 overflow-hidden">
                        <div className="w-full aspect-video">
                            <svg id="bike-canvas" width="100%" height="100%" viewBox="-800 -1200 2000 1800">
                                {points && (
                                    <>
                                        <line x1="-50" y1="0" x2="50" y2="0" stroke="#aaa" strokeWidth="1" />
                                        <line x1="0" y1="-50" x2="0" y2="50" stroke="#aaa" strokeWidth="1" />
                                        <text x="10" y="15" fill="#aaa" fontSize="12">BB (0,0)</text>
                                        <g stroke="blue" fill="none" strokeWidth="5" opacity="0.6">
                                            <path d={`M ${points.stTop.x} ${points.stTop.y} L ${points.htTop.x} ${points.htTop.y}`} />
                                            <path d={`M ${points.htBot.x} ${points.htBot.y} L ${points.bb.x} ${points.bb.y}`} />
                                            <path d={`M ${points.bb.x} ${points.bb.y} L ${points.stTop.x} ${points.stTop.y}`} />
                                            <path d={`M ${points.htBot.x} ${points.htBot.y} L ${points.htTop.x} ${points.htTop.y}`} />
                                            <path d={`M ${points.stTop.x} ${points.stTop.y} L ${points.rearAxle.x} ${points.rearAxle.y}`} />
                                            <path d={`M ${points.bb.x} ${points.bb.y} L ${points.rearAxle.x} ${points.rearAxle.y}`} />
                                            <path d={`M ${points.htBot.x} ${points.htBot.y} L ${points.frontAxle.x} ${points.frontAxle.y}`} />
                                            <circle cx={points.rearAxle.x} cy={points.rearAxle.y} r={bikeGeom.wheelRadius} strokeDasharray="10 5" strokeWidth="2" />
                                            <circle cx={points.frontAxle.x} cy={points.frontAxle.y} r={bikeGeom.wheelRadius} strokeDasharray="10 5" strokeWidth="2" />
                                        </g>
                                        <g stroke="green" fill="none" strokeWidth="6" opacity="0.8">
                                            <path d={`M ${points.bb.x} ${points.bb.y} L ${points.before.pedal.x} ${points.before.pedal.y}`} />
                                            <path d={`M ${points.stTop.x} ${points.stTop.y} L ${points.before.seatpostTop.x} ${points.before.seatpostTop.y}`} strokeWidth="10" />
                                            <path d={`M ${points.before.saddleRear.x} ${points.before.saddleRear.y} L ${points.before.saddleNose.x} ${points.before.saddleNose.y}`} strokeWidth="4" />
                                        </g>
                                        <g stroke="purple" fill="none" strokeWidth="6" opacity="0.9">
                                            <path d={`M ${points.bb.x} ${points.bb.y} L ${points.after.pedal.x} ${points.after.pedal.y}`} />
                                            <path d={`M ${points.stTop.x} ${points.stTop.y} L ${points.after.seatpostTop.x} ${points.after.seatpostTop.y}`} strokeWidth="10" />
                                            <path d={`M ${points.after.saddleRear.x} ${points.after.saddleRear.y} L ${points.after.saddleNose.x} ${points.after.saddleNose.y}`} strokeWidth="4" />
                                        </g>
                                        <g stroke="green" fill="none" strokeWidth="8" opacity="0.8">
                                            <path d={`M ${points.htTop.x} ${points.htTop.y} L ${points.before.spacerTop.x} ${points.before.spacerTop.y}`} />
                                            <path d={`M ${points.before.spacerTop.x} ${points.before.spacerTop.y} L ${points.before.stemEnd.x} ${points.before.stemEnd.y}`} />
                                        </g>
                                        <g stroke="purple" fill="none" strokeWidth="8" opacity="0.9">
                                            <path d={`M ${points.htTop.x} ${points.htTop.y} L ${points.after.spacerTop.x} ${points.after.spacerTop.y}`} />
                                            <path d={`M ${points.after.spacerTop.x} ${points.after.spacerTop.y} L ${points.after.stemEnd.x} ${points.after.stemEnd.y}`} />
                                        </g>
                                        <g stroke="green" fill="none" strokeWidth="4" opacity="0.8">
                                            <path d={`M ${points.before.hip.x} ${points.before.hip.y} L ${points.before.shoulder.x} ${points.before.shoulder.y}`} />
                                            <path d={`M ${points.before.shoulder.x} ${points.before.shoulder.y} L ${points.before.stemEnd.x} ${points.before.stemEnd.y}`} />
                                            <path d={`M ${points.before.hip.x} ${points.before.hip.y} L ${points.before.knee.x} ${points.before.knee.y}`} />
                                            <path d={`M ${points.before.knee.x} ${points.before.knee.y} L ${points.before.ankle.x} ${points.before.ankle.y}`} />
                                            <path d={`M ${points.before.ankle.x} ${points.before.ankle.y} L ${points.before.pedal.x} ${points.before.pedal.y}`} strokeWidth="2" />
                                        </g>
                                        <g stroke="green" fill="none" strokeWidth="2" opacity="0.6" strokeDasharray="4 2">
                                            <path d={`M ${points.before.hip.x} ${points.before.hip.y} L ${points.before.knee_bottom.x} ${points.before.knee_bottom.y}`} />
                                            <path d={`M ${points.before.knee_bottom.x} ${points.before.knee_bottom.y} L ${points.before.ankle_bottom.x} ${points.before.ankle_bottom.y}`} />
                                            <path d={`M ${points.before.ankle_bottom.x} ${points.before.ankle_bottom.y} L ${points.before.pedal_bottom.x} ${points.before.pedal_bottom.y}`} />
                                        </g>
                                        <g stroke="green" fill="none" strokeWidth="2" opacity="0.6" strokeDasharray="4 2">
                                            <path d={`M ${points.before.hip.x} ${points.before.hip.y} L ${points.before.knee_top.x} ${points.before.knee_top.y}`} />
                                            <path d={`M ${points.before.knee_top.x} ${points.before.knee_top.y} L ${points.before.ankle_top.x} ${points.before.ankle_top.y}`} />
                                            <path d={`M ${points.before.ankle_top.x} ${points.before.ankle_top.y} L ${points.before.pedal_top.x} ${points.before.pedal_top.y}`} />
                                        </g>
                                        <g stroke="purple" fill="none" strokeWidth="4" opacity="0.9">
                                            <path d={`M ${points.after.hip.x} ${points.after.hip.y} L ${points.after.shoulder.x} ${points.after.shoulder.y}`} />
                                            <path d={`M ${points.after.shoulder.x} ${points.after.shoulder.y} L ${points.after.stemEnd.x} ${points.after.stemEnd.y}`} />
                                            <path d={`M ${points.after.hip.x} ${points.after.hip.y} L ${points.after.knee.x} ${points.after.knee.y}`} />
                                            <path d={`M ${points.after.knee.x} ${points.after.knee.y} L ${points.after.ankle.x} ${points.after.ankle.y}`} />
                                            <path d={`M ${points.after.ankle.x} ${points.after.ankle.y} L ${points.after.pedal.x} ${points.after.pedal.y}`} strokeWidth="2" />
                                        </g>
                                        <g stroke="purple" fill="none" strokeWidth="2" opacity="0.7" strokeDasharray="4 2">
                                            <path d={`M ${points.after.hip.x} ${points.after.hip.y} L ${points.after.knee_bottom.x} ${points.after.knee_bottom.y}`} />
                                            <path d={`M ${points.after.knee_bottom.x} ${points.after.knee_bottom.y} L ${points.after.ankle_bottom.x} ${points.after.ankle_bottom.y}`} />
                                            <path d={`M ${points.after.ankle_bottom.x} ${points.after.ankle_bottom.y} L ${points.after.pedal_bottom.x} ${points.after.pedal_bottom.y}`} />
                                        </g>
                                        <g stroke="purple" fill="none" strokeWidth="2" opacity="0.7" strokeDasharray="4 2">
                                            <path d={`M ${points.after.hip.x} ${points.after.hip.y} L ${points.after.knee_top.x} ${points.after.knee_top.y}`} />
                                            <path d={`M ${points.after.knee_top.x} ${points.after.knee_top.y} L ${points.after.ankle_top.x} ${points.after.ankle_top.y}`} />
                                            <path d={`M ${points.after.ankle_top.x} ${points.after.ankle_top.y} L ${points.after.pedal_top.x} ${points.after.pedal_top.y}`} />
                                        </g>
                                    </>
                                )}
                            </svg>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-lg p-4 mt-6">
                        <h3 className="text-xl font-bold text-center text-gray-800 mb-4">Fitting 關鍵數據</h3>
                        <div className="flex justify-around">
                            <div className="text-center">
                                <h4 className="text-lg font-semibold text-green-600 mb-2">調整前 (綠色)</h4>
                                <div className="space-y-1 text-sm">
                                    <p>坐墊到BB距離: <strong className="text-lg">{angles.distSaddleBbBefore?.toFixed(0)}mm</strong></p>
                                    <p>騎乘 Reach: <strong className="text-lg">{angles.riderReachBefore?.toFixed(0)}mm</strong></p>
                                    <p>騎乘 Stack: <strong className="text-lg">{angles.riderStackBefore?.toFixed(0)}mm</strong></p>
                                    <p className="pt-2 border-t mt-2">膝蓋彎曲 (6點): <strong className="text-lg">{angles.knee6Before?.toFixed(1)}°</strong></p>
                                    <p>膝蓋彎曲 (12點): <strong className="text-lg">{angles.knee12Before?.toFixed(1)}°</strong></p>
                                    <p>軀幹角度 (6點): <strong className="text-lg">{angles.torso6Before?.toFixed(1)}°</strong></p>
                                    <p>大腿角度 (6點): <strong className="text-lg">{angles.thigh6Before?.toFixed(1)}°</strong></p>
                                </div>
                            </div>
                            <div className="text-center">
                                <h4 className="text-lg font-semibold text-purple-600 mb-2">調整後 (紫色)</h4>
                                <div className="space-y-1 text-sm">
                                    <p>坐墊到BB距離: <strong className="text-lg">{angles.distSaddleBbAfter?.toFixed(0)}mm</strong></p>
                                    <p>騎乘 Reach: <strong className="text-lg">{angles.riderReachAfter?.toFixed(0)}mm</strong></p>
                                    <p>騎乘 Stack: <strong className="text-lg">{angles.riderStackAfter?.toFixed(0)}mm</strong></p>
                                    <p className="pt-2 border-t mt-2">膝蓋彎曲 (6點): <strong className="text-lg">{angles.knee6After?.toFixed(1)}°</strong></p>
                                    <p>膝蓋彎曲 (12點): <strong className="text-lg">{angles.knee12After?.toFixed(1)}°</strong></p>
                                    <p>軀幹角度 (6點): <strong className="text-lg">{angles.torso6After?.toFixed(1)}°</strong></p>
                                    <p>大腿角度 (6點): <strong className="text-lg">{angles.thigh6After?.toFixed(1)}°</strong></p>
                                </div>
                                <button type="button" onClick={handleAnalyzeFit} className="ai-button-secondary">✨ AI 分析「調整後」騎姿</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {modal.show && (
                <div className="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
                    <div className="fixed inset-0 z-10 w-screen overflow-y-auto flex min-h-full items-center justify-center p-4 text-center">
                        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                            <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                                <div className="sm:flex sm:items-start">
                                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 sm:mx-0 sm:h-10 sm:w-10">
                                        <svg className="h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-4.5 0m4.5 0v.75c0 .621-.504 1.125-1.125 1.125h-2.25c-.621 0-1.125-.504-1.125-1.125v-.75m4.5 0A12.06 12.06 0 0 0 12 18.75a12.06 12.06 0 0 0-3.75 2.383m3.75 2.383c-.397.023-.79.038-1.175.054l-.261 1.634a1.5 1.5 0 0 1-1.48.905H12a1.5 1.5 0 0 1-1.48-.905l-.26-1.634a14.314 14.314 0 0 1-1.175-.054M8.25 15.375c-.621 0-1.125.504-1.125 1.125v.75c0 .621.504 1.125 1.125 1.125h.375a12.06 12.06 0 0 1 4.5 0h.375c.621 0 1.125-.504 1.125-1.125v-.75c0-.621-.504-1.125-1.125-1.125H8.25ZM12 15V-7.5" /></svg>
                                    </div>
                                    <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                                        <h3 className="text-base font-semibold leading-6 text-gray-900">{modal.title}</h3>
                                        <div className="mt-2">
                                            <p className="text-sm text-gray-500 whitespace-pre-wrap">{modal.content}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                                <button type="button" onClick={() => setModal({ ...modal, show: false })} className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto">
                                    關閉
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
