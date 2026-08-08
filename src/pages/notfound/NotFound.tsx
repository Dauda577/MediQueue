import { useNavigate } from 'react-router-dom'
export default function NotFound() {
  const navigate = useNavigate()
  return <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px',textAlign:'center',background:'linear-gradient(135deg, #f0faf7 0%, #e8f5f1 100%)'}}>
    <span style={{fontSize:'80px',lineHeight:1,marginBottom:'16px',opacity:0.6}}>404</span>
    <h1 style={{fontSize:'1.25rem',fontWeight:700,color:'#1A2E33',marginBottom:'8px'}}>Page not found</h1>
    <p style={{fontSize:'0.9375rem',color:'#5C7A82',maxWidth:400,marginBottom:'24px'}}>The page you're looking for doesn't exist or has been moved.</p>
    <div style={{display:'flex',gap:'12px'}}>
      <button onClick={()=>navigate(-1)} style={{padding:'12px 24px',border:'1px solid #D8EFE8',borderRadius:'10px',background:'#fff',color:'#1A2E33',fontWeight:600,cursor:'pointer'}}>Go Back</button>
      <button onClick={()=>navigate('/')} style={{padding:'12px 24px',border:'none',borderRadius:'10px',background:'linear-gradient(135deg, #05668D, #00A896)',color:'#fff',fontWeight:600,cursor:'pointer'}}>Go Home</button>
    </div>
  </div>
}
