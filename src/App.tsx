/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { QRCodeCanvas } from 'qrcode.react';
import toast, { Toaster } from 'react-hot-toast';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function AttendeeCounter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const q = collection(db, 'registrations');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCount(snapshot.size);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="text-center p-6 bg-[#F1F5F9] rounded-lg border border-slate-200">
      <div className="text-sm font-bold text-slate-500 uppercase tracking-widest">จำนวนผู้ลงทะเบียน</div>
      <div className="text-4xl font-bold text-[#4A554E]">{count}</div>
      <div className="text-xs text-slate-400">ท่าน</div>
    </div>
  );
}

function AttendeeList({ list }: { list: any[] }) {
  const [selectedQR, setSelectedQR] = useState<string | null>(null);
  return (
    <div className="mt-8 w-full bg-white p-8 rounded-lg shadow-lg border border-slate-100">
       <h3 className="text-xl font-semibold mb-6">รายชื่อผู้ลงทะเบียน</h3>
       {selectedQR && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedQR(null)}>
             <div className="bg-white p-6 rounded-lg shadow-lg">
                <QRCodeCanvas value={selectedQR} size={256} />
                <button className="mt-4 w-full bg-slate-200 py-2 rounded" onClick={() => setSelectedQR(null)}>ปิด</button>
             </div>
          </div>
       )}
       <table className="w-full text-left">
         <thead>
           <tr className="border-b border-slate-200">
             <th className="pb-3 text-xs font-bold text-slate-400 uppercase">คำนำหน้า</th>
             <th className="pb-3 text-xs font-bold text-slate-400 uppercase">ชื่อ-นามสกุล</th>
             <th className="pb-3 text-xs font-bold text-slate-400 uppercase">สังกัด</th>
             <th className="pb-3 text-xs font-bold text-slate-400 uppercase">ตำแหน่ง</th>
             <th className="pb-3 text-xs font-bold text-slate-400 uppercase">QR Code</th>
           </tr>
         </thead>
         <tbody>
           {list.map(item => (
             <tr key={item.id} className="border-b border-slate-100 last:border-0">
               <td className="py-4">{item.title}</td>
               <td className="py-4">{item.firstName} {item.lastName}</td>
               <td className="py-4">{item.department}</td>
               <td className="py-4">{item.position}</td>
               <td className="py-4">
                 <button className="text-[#C5A059] font-bold" onClick={() => setSelectedQR(`${item.title} ${item.firstName} ${item.lastName}`)}>ดู QR</button>
               </td>
             </tr>
           ))}
         </tbody>
       </table>
    </div>
  )
}

function AdminDashboard({ list }: { list: any[] }) {
  const stats = useMemo(() => {
    const deptStats = list.reduce((acc, curr) => {
      acc[curr.department] = (acc[curr.department] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const posStats = list.reduce((acc, curr) => {
      acc[curr.position] = (acc[curr.position] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return {
      dept: Object.entries(deptStats).map(([name, value]) => ({ name, value })),
      pos: Object.entries(posStats).map(([name, value]) => ({ name, value }))
    };
  }, [list]);

  const COLORS = ['#4A554E', '#C5A059', '#8884d8', '#82ca9d', '#ffc658'];

  return (
    <div className="w-full space-y-8">
      <div className="flex justify-end">
        <button 
          onClick={() => {
            const headers = ["คำนำหน้า", "ชื่อ", "นามสกุล", "สังกัด", "ตำแหน่ง"];
            const rows = list.map(item => [
              `"${item.title || ''}"`,
              `"${item.firstName || ''}"`,
              `"${item.lastName || ''}"`,
              `"${item.department || ''}"`,
              `"${item.position || ''}"`
            ]);
            const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob(["\uFEFF", csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'registrations.csv';
            link.click();
          }}
          className="bg-[#C5A059] text-white px-4 py-2 rounded shadow hover:bg-[#A6864A] transition"
        >
          ดาวน์โหลด CSV
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow-lg border border-slate-100">
          <h4 className="font-semibold mb-4 text-center">จำนวนผู้ลงทะเบียนตามสังกัดงาน</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.dept}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#4A554E" name="จำนวน" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-lg border border-slate-100">
          <h4 className="font-semibold mb-4 text-center">จำนวนผู้ลงทะเบียนตามตำแหน่ง</h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={stats.pos} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#C5A059" label>
                {stats.pos.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <AttendeeList list={list} />
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<'user' | 'admin'>('user');
  const [list, setList] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, []);
  useEffect(() => {
    const q = query(collection(db, 'registrations'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [lastSubmission, setLastSubmission] = useState<any>(null);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    
    try {
      const registrationsRef = collection(db, 'registrations');
      await addDoc(registrationsRef, {
        firstName,
        lastName,
        title,
        department,
        position,
        createdAt: serverTimestamp()
      });
      toast.success('ลงทะเบียนสำเร็จ!');
      setLastSubmission({ firstName, lastName, title, department, position });
      setStatus('idle');
      setFirstName('');
      setLastName('');
      setTitle('');
      setDepartment('');
      setPosition('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'registrations');
      toast.error('เกิดข้อผิดพลาด โปรดลองใหม่อีกครั้ง');
      setStatus('idle');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#FDFBF7] flex flex-col text-[#3D3D3D] font-sans">
      <header className="h-32 bg-[#4A554E] flex items-center justify-between px-16 border-b-4 border-[#C5A059]">
        <div className="flex flex-col">
          <span className="text-[#C5A059] text-sm font-bold tracking-[0.2em] uppercase">Official Registration</span>
          <h1 className="text-3xl font-serif text-white leading-tight">งานแสดงมุทิตาจิต ผู้เกษียณอายุราชการ ประจำปีงบประมาณ 2569</h1>
        </div>
        <div className="text-right border-l border-white/20 pl-8">
          <div className="text-2xl font-bold text-white">2569</div>
          <div className="text-xs text-white/70">FISCAL YEAR 2026</div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center p-8">
        <Toaster />
        <div className="w-full max-w-2xl bg-white rounded-lg shadow-lg p-16 border border-slate-100">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-2xl font-semibold">
              {view === 'user' ? 'ลงทะเบียนเข้าร่วมงาน' : 'แดชบอร์ดผู้ดูแลระบบ'}
            </h2>
          </div>
          
          {view === 'admin' && user?.email === 'pparichata@gmail.com' ? (
            <AdminDashboard list={list} />
          ) : (
            <>
              <AttendeeCounter />

              <div className="space-y-8 mt-12 mb-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-slate-100 flex items-center justify-center rounded-full shrink-0">
                    <span className="text-[#4A554E] font-bold">📅</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">วันศุกร์ที่ 4 กันยายน 2569</h4>
                    <p className="text-slate-500">เวลา 09.00 - 12.00 น.</p>
                  </div>
                </div>
              </div>
    
              <form onSubmit={handleSubmit} className="space-y-6 mt-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">คำนำหน้า (Title)</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="w-full px-4 py-3 bg-white border border-slate-200 rounded-md focus:ring-2 focus:ring-[#4A554E] outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">ชื่อ (First Name)</label>
                    <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required className="w-full px-4 py-3 bg-white border border-slate-200 rounded-md focus:ring-2 focus:ring-[#4A554E] outline-none" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">นามสกุล (Last Name)</label>
                    <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required className="w-full px-4 py-3 bg-white border border-slate-200 rounded-md focus:ring-2 focus:ring-[#4A554E] outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">สังกัดงาน (Department)</label>
                    <input type="text" value={department} onChange={e => setDepartment(e.target.value)} required className="w-full px-4 py-3 bg-white border border-slate-200 rounded-md focus:ring-2 focus:ring-[#4A554E] outline-none" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">ตำแหน่ง (Position)</label>
                    <input type="text" value={position} onChange={e => setPosition(e.target.value)} required className="w-full px-4 py-3 bg-white border border-slate-200 rounded-md focus:ring-2 focus:ring-[#4A554E] outline-none" />
                  </div>
                </div>
                <button type="submit" disabled={status === 'submitting'} className="w-full py-4 bg-[#4A554E] text-white font-bold rounded shadow-lg hover:bg-[#3D453D] transition-colors disabled:bg-slate-300">
                  {status === 'submitting' ? 'กำลังบันทึก...' : 'ยืนยันการลงทะเบียน'}
                </button>
              </form>

              {lastSubmission && (
                <div className="mt-8 p-6 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="font-bold mb-4">ลงทะเบียนล่าสุด:</p>
                  <button 
                    onClick={() => window.print()}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
                  >
                    พิมพ์ใบสรุปการลงทะเบียน
                  </button>
                  <div className="hidden print:block mt-8 p-8 border-2 border-slate-800">
                    <h2 className="text-2xl font-bold mb-4">สรุปการลงทะเบียน</h2>
                    <p><strong>คำนำหน้า:</strong> {lastSubmission?.title}</p>
                    <p><strong>ชื่อ-นามสกุล:</strong> {lastSubmission?.firstName} {lastSubmission?.lastName}</p>
                    <p><strong>สังกัดงาน:</strong> {lastSubmission?.department}</p>
                    <p><strong>ตำแหน่ง:</strong> {lastSubmission?.position}</p>
                    <div className="mt-4">
                       <QRCodeCanvas value={`${lastSubmission?.title} ${lastSubmission?.firstName} ${lastSubmission?.lastName}`} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      
      {/* Footer is missing from App.tsx originally? Let me check. Ah it was part of the original design html but not implemented in the component. I will add it if it's needed or just stick to what I had */}
      <footer className="w-full h-12 bg-[#F1F5F9] border-t border-slate-200 flex items-center justify-between px-16 text-[10px] text-slate-400 uppercase tracking-widest mt-auto">
        <div>© 2026 Office of Government Personnel Management</div>
        <div className="flex gap-8">
          <span>Schedule</span>
          <span>Guidelines</span>
          <span>Support: 02-XXX-XXXX</span>
          {user ? (
            <button onClick={() => signOut(auth)} className="text-red-500 font-bold underline">Logout ({user.email})</button>
          ) : (
            <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="text-[#4A554E] font-bold underline">Admin Login</button>
          )}
          {user?.email === 'pparichata@gmail.com' && (
            <button onClick={() => setView(view === 'admin' ? 'user' : 'admin')} className="text-[#C5A059] font-bold underline">
              {view === 'admin' ? 'Back to Form' : 'Admin Dashboard'}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
