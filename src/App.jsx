import { useState, useEffect, useCallback, Component, useRef } from 'react'
import { supabase } from './lib/supabase.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'

// ─── ERROR BOUNDARY ───────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(p){super(p);this.state={err:null}}
  static getDerivedStateFromError(e){return{err:e}}
  componentDidCatch(e,info){console.error('ErrorBoundary caught:',e,info)}
  render(){
    if(this.state.err)return(
      <div style={{padding:32,textAlign:'center',color:'#ff4757'}}>
        <p style={{fontSize:16,fontWeight:700,marginBottom:8}}>⚠ Error al renderizar este módulo</p>
        <p style={{fontSize:12,color:'#636e72',marginBottom:16}}>{this.state.err.message}</p>
        <button onClick={()=>this.setState({err:null})} style={{padding:'8px 20px',borderRadius:8,background:'rgba(255,71,87,0.15)',border:'1px solid rgba(255,71,87,0.3)',color:'#ff4757',cursor:'pointer',fontSize:13}}>Reintentar</button>
      </div>
    )
    return this.props.children
  }
}

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const P = {
  bg:'#0d0f17', surface:'#13151f', sidebar:'#0a0c16',
  card:'linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))',
  border:'rgba(255,255,255,0.07)', text:'#f1f2f6', textSub:'#a4b0be', muted:'#636e72',
  purple:'#6c5ce7', purpleLight:'#a29bfe', purpleDim:'rgba(108,92,231,0.15)', purpleBorder:'rgba(108,92,231,0.3)',
  blue:'#0984e3', blueDim:'rgba(9,132,227,0.15)',
  green:'#00d084', greenDim:'rgba(0,208,132,0.12)',
  red:'#ff4757', redDim:'rgba(255,71,87,0.12)',
  orange:'#ffa502', orangeDim:'rgba(255,165,2,0.10)',
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const STAGES      = ['lead','contactado','propuesta','negociacion','cerrado']
const STAGE_LABEL = { lead:'Lead', contactado:'Contactado', propuesta:'Propuesta', negociacion:'Negociación', cerrado:'Cerrado' }
const STAGE_COLOR = { lead:P.muted, contactado:P.blue, propuesta:P.orange, negociacion:P.purple, cerrado:P.green }
const ETAPA_STAGE = { 1:'lead', 2:'contactado', 3:'propuesta', 4:'negociacion', 5:'cerrado' }
const STAGE_ETAPA = { lead:1, contactado:2, propuesta:3, negociacion:4, cerrado:5 }
const STATUS_COLOR = { new:P.orange, read:P.blue, replied:P.green, archived:P.muted }
const STATUS_OPT   = [{value:'activo',label:'Activo'},{value:'prospecto',label:'Prospecto'},{value:'cliente',label:'Cliente'},{value:'inactivo',label:'Inactivo'}]
const SCOLOR_MAP   = { activo:P.green, prospecto:P.orange, cliente:P.purple, inactivo:P.muted }
const PRIO_COLOR   = { alta:P.red, media:P.orange, baja:P.green }
const LOGO_URI     = "data:image/webp;base64,UklGRtQ+AABXRUJQVlA4WAoAAAAMAAAA/wAA/wAAVlA4TEA4AAAv/8A/AE1AbNtGkATHwmyCXP8N/0x29iuI6P8EAHppV1UcM0GvVBUjXal/k5l63Z9Jqoqv3BHdv+5MrtndbbjjKm/zTsvDSzF47pTPD7AueJjrWZ8Aa8LBxycAacNPgo3PmWJpSRKAAEk+SxKabGXb+DkMT94CjELSTAKYQPeMDYNFRMRo3yeRK1S2Ny1AEyCz23+00YYJEVG2ZD8tSUgC9Z+1dmq9bW0XPBlRtuTZETIzIuKTiIiyfOnZRV3j2bWv5UcLubFt222zSmD/VSFEuEOGZ+Afc4ByC1IjSbIky+/7yhalPXQw4MLVX6oVQWIkSYokxTGDCKe/NCWC3zN/PfNb/yeAR8JXARGREgCICBkBh4gYuuOZALBGJAw8BeAYYoiIEANERCAiG1ujEBGNiXBDhMcxEZEhEFwhlCgixAjoJiJlGYAxJGNEBBEiREQMKQKICBAYMYKBiEwCRUCAIKIDiBcA2smIjAAOIgAbiZ0wZoAiSAQCWUQwABpjkBUw+/1KNI1sIMMQAQMWEVlkyBhAEWYnwmemMU7ohwADBsYywg4imk7e7NP8jPAehjDAEIihRxvCGERZ8z7n8f/4YHbQT61BRBk6GAGKcRxnihH0OMYYEfQ4YBF9/A2zYygNIovIop8fZpYIs9nYiY2RRER0ObycEsacfpEg4h7Z7CUDkQwUyFyav39dU5qdfTALiN7g5MQSQGQaILpEICLcME1ERPMzSxE4AIhABABEBBBAtN+Ti0t7LIgCiEDQ/Ymmi9vufIr0FhER7nRaEBGNiYhoj4goaMKLmIjkiUCePBFmxwt63O/Z/JxIEBH0BAT8IbzObwa8H4ho2uezT4gIn+2FZYHucRDKX4JX7do9G3uczTFNsUxBgGFhS08jvCItXV7MiwBtpyMsoulDALDMDSLABkSX5v8cE12uiIwQPjLbGU1zvJ6ICA6gIkwQaGcAl4/2EQZAiL2FMfMaBEQIhCivQC6ALh8j4mA5gBd8NYZERFHAFgOEgBxEhIF5ImCESgCCZgkRYfC/EqApAksQAhBjBIANkXkgFUYoxskYQAhgDADQd6D3irIiEEAgxjAiTwbEYADecNC2kSA55c969/YfQkRMgCqvY9vk3Ojzxrb53FShCu2nXKvcvGyDWmza2B+uK9hsfgqZsA26eR9ms+kcXRKdsKkYqtXKYltDl6CmbatVzioMnetxowrDjtUeqHKcx7mHyucDfeq2w7GeVTnGNp0Olb4HWxWdm/BRSX+1m04HDwrFhyp8nK7dRoWLI6UP1tVxxUu2BHGolMfukpLIfUMGMWfog83t1x3Njp/zusF+sB2x3eyhah3Xj8dKrVT7h4y583W2/5YjyQ5Zo7NkytOV6uZ0F7qQs1eksf5rRZBV239kNXr9Avp5rOIfBL0MdKBRxgBdEn6epiOMv47VO1cDtAYcJIS2dkcLZ6nEHEiKZFu2lazb0EhAHvIwgxRmf0S8syC0jSRISmqO5QN59NuJCcDE/r9ix3IudA8zw2qyZGbeMiyZmZmZmbPCJcOakyUzrt46nDST711U1alzTpV7/Q3H9b/RCSf+q+RQ+6pLwzO+Gf3Dif2kCnerwmTLYXKUfruRO5Ij27ZqK3Otc+/9irtD6JbSBXdphktOZplDSPbTRw+I3N3d3Z6csyVJkqRIklrUzHvpNMu8V3os72bEBOh1bWuaJDlyC1AcX53i9JYUpxr+39wjB1DeKu0z4GgVjAODa/+X/BCSA8bBNbJH67mzjxDin7gP8CXgUsNQXnDcNpIjqQr72/wj3fOmhKBt2yQ5qfMHtsYE/Af+3MVN3QLMQaHhajjeCMKON8k93dA08sbZd5ZpeODbwI3dDpGpg2HyoJ58cIC1ezPgh3RQH+LnQ94HeJDqt1v2W56+iXvb7jrtx4x239C4fOnfzPH689f15zzl1083UX/QT9fTs1v91h+u+en6B18/yYfBtnFw121w2J4/jBdsD5FrOc2ZmJm9b6R2EDsRMmPMxX7MK5GiWzjnIWMZuNcE7hTgEzy4+5keb7kfCJ/DSHnDxm9DAIbjBC3wXpPZSSyZJpuRSieIRbNJpCJ2MwiEtHDW7aYquEVDwK1o00HtxDt5YoRbp6PXpD4FVQaDez2puM9YC6BCNXC5NNleJligZhiT+SBmlt4HaRqTWLJ4TKIlOuAY0mKDYU7mnHWpMN8KFUMawFWHdMk8aw6CPgSBzjkTvhCSzabb3DZeJi63bhJxTMZwNI1JLAlJ2rxNiEnssru2kPI0GX2ScyakgOLT1CSZLQUbAdK8FbiQGNeUagsbPsegRPmixGbzQYgpFw5q+JJlVC1IuyyeCTt+4UVOCMTentuLIOConUmmze3reyUwEQ2ZG8e3rXdcg0vRRxp6uSCj3gNbCM8VFRAOgM3m1kNagHZgWBjEkuZk+71mIPbw/GNjvluaFJMmUZN5n7T7LeLoRXYraEEkySBwv54uinI0iHOGg8+etxdsTqiqzq+q64zkmIdC299sYJiNScwt/OIlTWMuWz+29pw9G83er7PEnJNZxbsACr2J1+Yykyc8paJ4QPRwVoQ8rYixRhqpzqYxrYRgdW/OboeHX/jLFzAsDWLJ7BfImGAVeJXQWxOwGQHmffKaAJb2nU6HrnvwjEDFu9mKYZaY0zMkhneqYWtZoOwihGO1ZmMSc/t8pVs6Ab4qeZ98vQVPTxiIATIxMp2QC4qIuq/IYLtEOWxhM1u28Wzz5ffSoKoKM56FLayaYOGKLQhiMhrNRuyWkzymhRPgN77jwL3VTBKggflMmu12f01IZZoYlAhEXS+D8+oE7hNCfwu1JFwnuaZYuHzztzCMCW/HIBo51zympc7t7s99VFUxadwZE6TnBHCawTVmYtIjAiEQYXZ8joMxnmvr3kXGnGRiYmwWf8kFxRZBsQWYDYbFvRWkpVfgZEENPEnusE9ggFmuk/U5h4WhWfLkAyJ4uuN4Cs1OKucxotAlAGHTpWetGvu3OAAL9NC9tQJtANmrmEjiH4CgAJ6Sc/8aoRZMSwlF+QOXGlYj3imKi/VzrJizAQkJiDTmn2I/jhbKsR5f1+wbXFk9kDyZFUoAd2KABt2O0Y/0LpyMzsWmd9smRzCe4kUO74dwcK825yTGaYl2kCcQhhbxk50jitl6bN30ynKSmlDzzhwTAoOjX9l2sG1KO0RZGKbDkeIV6pLnCobOwJ6zHOe5gXhZeH4EhYf9bTusbjgBJsuCeyY9oV1+USkASydFhux9LtdnSqpfbJIaImJdnWPreLpcqPUDRducpL5UKap8o/0VHmTES/P8KJqHmb6o5IZTApNlCt4kaY+MNAFDtE/2GF5NywlFUREuQmKM7ZexGRtjuoMpowXmKStwsK/2bgwPbuiak7XR9pqYzfT+iQbFytMnF0jygkvVndxSmZZQZ0hRoopLxU3HcDyP0MlDRWfzz/9MwqNDFIZRrnsptAoZvOTk9oJ1Tb0DVdlBo+0CLxJOycnOOaGbZrBtTgoRihqbrr70scmQ/7lhL7ZWsfnD0L0rYi+OVoXT1dIBG8xKG1wNQYYCeF191a1w5eSk6w0KYbqVS6xrmdb4JX4lje0A0JWKOcFD+WFl7JBrvhYfxP5yLZy6iBP8sXE1q6n3Su1w3jUEBuY5rbaUKF2HmukB0RkKP15/qQ1BUZ5B3EPboIp4gxF7KLQQDD3Awldh6UKi+iTFjOvp7fQymY6N1XanIWS6O4BZRHYkBZeazAZllAE9THtc4KLKiPXzL5eLdXtuJuzm6Lq/fPO1WFrE12N8xT+K+Y111ds7ieASBSardrUwpWlvqVjpOakPSXkiVH2yXdWoF8ULNcebMLDNHFBi7G/2/BC5+22zbCWWFWMj78aVj9mh2S/GwwwEsDln+Lx2un2+2ueGGMFV2Ht4AfrGDzHl/aeCJbbRqP0tPe+pUGBoZYfIFKMfGytSaU/y05KKaRW4FCIDCGhMvqBzOup9Ul2JY1eI4Jly7+KkSmgKiO0XM0QFB0kqcB42YTwM5xD5cUCfrNKDm2W3/IIo4yoGApjJD3y1uOwaEaZlE1Xny6+oMDwhgzjbBJz2iY0UAYdNPcC8+XvcBipX8yVJGhLEFqkF8EJxnVnXPC/pKiIcMFDZyapzbBj1ixZDd4QAbpsA4gDNYROMByi0CvkVAxyvZlPBHRJcwW0bgCFnOmSD2Oa6SjIHhDMOHd2bZuuCKrbNr0yQtgrf3sFLYOh7KrYw1/2s68O2QhgQPZnO1fhA41lXAAMJunv0I6lzWucQJwVHA+/+UFbvVoOAY7Bn5W0GZs/PmB9imQ62Ed14kFxz60se8voj04yO3kBK4FJQHP+5bJVkwGbhBaUjU/MSQpXwHsZgExC/xKdCdCMH/irFM78Nq0OQCn74w3pe9AmJzmYqnbEYBtzbBYHepXXJ0iqGIVwu8WzDIVQl6UBVncux6qJKaIYej2i9hwGrmAFNZjP7BLFawYg3No6L2TlJybb1mb6h9OPFSg8h0AnDeWRiF5uoQLuaHapw0pgNXTya4hfU41BIDj7xEculZ7LaZKmwrV6AV/xOefh30+fSvCAgxacS2Htlgw3HnHPEmJk/EvKxNMeGGDsY0GJdEPwUYfYupRveKMTRALXaxtqoRfeFS41E6Yr+4+WjKp4dqAD7qh32MMIvOpb12+YJg7FkthOPZeFoePEtz0ImgSYCKANhVIFXhrhXIUn6IooU4UL8oBCvPShuNgeIU1xhd2vaeiY0SzkJzZLUgqYiUX1XI4ueyCsSqwVSF92Y5V3oa7reI3VqrrMKPbrh2Y8BZy4XPJtuQHTeAJG9XZQoQXYMVKNmChWps5GOAdfXV45u2+VCqLqwXgKqOK8nzbVRsqKjhAouOQTeI1KwxRoB4mfaBnvkkklIfxICotdoVEG+1lMl/TRJ8z6VX4JJjFfGsa/o6JpdhDJNzQtVlNcoDKIKEJGA7l00CNHHaId2gbm4uiK9H3onXc1fwcYV7I1i+S6AaUZp/pKjoOuZjRENR7iogLODpIPNqA4Jn/Y+OG1UXQnOudN8aL4wdph24sGSJGpuz10WtHctzEk7sRgwF3qG/2blqlNwvdo8dKTpL7YSMZveBN2iaPmBdM1IMTnLXebDdDCWNI+IltbMyW9vhd5CwESARTc7pIZgAvQJn/4RPp30b8jXr2H9hDFmjrqBLMJqE4onG4HhcknxAlWgZ4R4ejD20wyzA9V6YC3qi2bT4imAqzlaiTOY/8xqSZPNxigP+gGdARFQpmXA/tSeBd285D6InyakmIydUmiGZqN2s4PimOYjF5BiZiLYZNYHGNKVQS0s0PlHVnKyrp+oviwEhGAo400Ua9UvOHhACv0UqKIyBuQjLA6MBbvHhIHQ51ZTJuYpgKtZH36dyJUNJmAB3fT6tad22exzWNoJ7uUKEmDbmyFBdXmFfPLO2NNsTMYedg30mPDXVs4Ar94GoEWYXooqUUBYds28IFH6WPtYUnrGELbtB8LfUxUuVDlTBmJuNYEqparDUbNsxr6a0fj8AA8auLaytc/TBwRu9EVzVBh1ZgBDQDf7fBIdV7vfS3VW47MPwxhbEDiqAAsQ22gAvTcHsXwIf9vXbOAsRe4UgBbCUYn0KK/m0fWKYbGNAiwevXaUHbNFECjHUIJ8C+Xsipe6/BbinFNAFZzExy3ix31lY4Ii6a1pQe7wKE/PJ4u/0mzuvNeNiUPAedLxkqTA6UvM9AxQIsN0+9zh2eFTEsRYqex3sez1A+tb30+74j2DsYf5aDxydUhr61ROFt4EHQwaMIE1zF/xx94zei99tffzVeSk+dazTs+biXgWVLHMpndXh9Hqe1h4yNrT4+3ItdReXyVwZylyySScXyx8hufA5eTLRvZlvb5hfxNperz3xjdwvh7WWy9Q161gJkAKaWdd4Z7ZkeWkWn0PjMkinu5Zzvi19Si/YppZCkQZ5hwWdmxvMTnZf/zlh1y/HD6hTsiPt558/soEagI2XTpB+GR+IFPosdtCg23s0Hme0YJH/dbqlGxWteIZEPf3Bc/ar9J+IwWGfvjksEbifN34eK2TpxSYNEjBedd8zQULh2bfS+5o9cZj70v8YOFId0AgYCIomPUVnCfd9CvJiaol6enTNLe2s6e/e/ZakeF3m/X6lm7t6Go9lfXu8Dwqk4rmC6TA2RBJ7DI7JoHjTo/xHkuUorUk5Li13nhegXdWJ5C5mL5op3bvS47S9/W213TS6x4hw7PDyV+cTpy6W/v4y7+HvyMoMF9UkOJ4DtMee2jeA30SYXJROS6D3vJeeO09kYCJWK8bE/HUP771Lrp2ocNErTEze/nN3Xd8s25XJ04jPt56jM1n0snWR785++O/9vIf/fE/+ce/FhhRubOMkXGCI0mZBo47zOdo9Jh7W9I9/rdWkgHQjZKrtDAOnzqoydYQJwABVp+OB4WZW13SPuus3nmVd1mz77J28f52Z3q7c/s2p/ctj3ulfUdmgVeCaWQkOlcZ6Jpj8qIZutilOXTtQp970BxLci701mwzEl8jLTUbLoknTujPjQ5k++lzHFRxpwiPn0VP87fW65c5+6OztBCDATDECZI1ntIeh3tJCJ1Y9vBjp9RuDBDown6fJ2nenAA2JJ74zu0EmOVNDTHAnbA/sX/4B2/9PzBKlhsDNiCsPk+a+YVsxRwhSyqEjCNiT5XRK+UkkBmtPglN83FzBznIRj+xHhJgw0tLcNDG8ffnT++E0M0MqM18TMQMAzZyI2f+d+sO0VhYUplOAjmXk9lOBnQPmw/xztFPFu57TJvB1hjhMxb2SlU/1KiHarY2dlPa20vSI9av8hqTkGG7nhuzgSCkhUMOs9lDSOhCEvabrVxEirnmcUYsu9XSGvqdWH0xrbzqimhwA3MY8YV4oGZr4+Nf7N7u4WKu/4hgIGyqkoRuSwkfcjRmAzH3GHMu53afEsgdlvrE8neA3qW3RXM1iIYQHYfR42DUwzRbG5/0ysd9xZ+lfsYxRCxPcLpFaB7tHEZrOhN7yJ3Snm9rTnwLNx7/DtAi4kcUXIUfCDqrd+jHgwdutjY++bWP+rL3/o/ddDiTvV4AwchKTAJJuDVjMszvkBOPikAkclHUn8xfJ806WMFr5neiN76MUerMFss2FKFev4rXMgeSppvZNe01pNkwJns9cslJbuPRaoln81dLfyAwWBUWHfmiY7XNgQzBIqgvAwakWu1Mto7LTvuMuWyEpEQVt6Fx8Xw1H978vFkcn8tpDTMtXkwJnv2DgIVwilggghygwGAhdpdErE+mcQl/tTjX7HyebC3780YEXKo4M1qC16uPD0gBKemDzmnSjLDjNh6F33HhJ+arhcMxP6X5VTPYkiUY3eTX2g2n4nQM4AGEfhkkVQxWT2vu0Ny8PALNrEsqqwWLb+yT1DzjRTM+/wSWIIbgvyV4OdyhjscPqIIruuHWUuAPdL74MmIPs5uX1nGy7lJB9VRy6LcbafnWsI3oLAU+Dw8f7sfn7XBfcfoB+PvfgyS8cKKn6UYSkd6+B9Ut/MjuD9LSjmE2dvRAgtRi9fDjpy3O3n4a2Qf/9FeHf3n6xvrHhRHYrMSZTWEOxSqmXiJ/fjDjPAgLQ6wIqAH2fyFcXO50iXNth/8dffoleoZ5vcRm04btNvI1g8RqZ4tPXap+wF/wNlYVIxkw3HAb2/vp1rvZ3j7FD6fXJKJ3aJFwXd0p1jPfxss9N+ace43uTQ7vF7ffvOpBpzGtcpv4lLfsaXbbAbA4fKz6A/i8OK6gLDfW/0A/bbLnUUAq9Iae0GseI+9wiXP0OrzqhPNEXv9QL7u1U72dJN8OzS5mNnu1EIopNZgLg3i6kt3+fGQagRCaoTlhCf3NZdybozHi85mXVzliXuZkf1uz0P/O14mqbFn3AlZODc3UYfeM+EYPbm5ytKh3y2qSSuiKY9ZR/VTO59VdwtjuPmCNBrNuNqFj2/aTtTyv1GJPpAfWTNkLBqEZ2FwJvXU59xwfYVRE1BXco3+n7A36rUThEx2F0/7qUxM8e9Q3bxZNvQeZrcwxYBP6Urjzx5973Njp+DF+GjE+g9k4WoL1rvlJ9pA6Vta6iVwIf85EPXNcJ+8Y5gP+lQdtQUh1525xHG95jPFTh8HojqGXLYdDClGJzferADQn/m7aF3TzMUnVZ4L/10L+5NjzLz7iW10mf8H/ozt/Gx/QLuZX6xrIHr5Xr8eq2ria70SgtDMDVIPdzVLcQdyq541FL5zrjy9+YT/LPKTFpfB1s/VTSBLn75hE54T4znfodn8lGmHAOEUTqIbJTz+J4/H19YTbS7/cilwp2TWlZorvhOAwQHxfdrv2mYUVa7/LQEDFP0Y9KxF3eOUYA9ePPMtQ155asDZCu/OnkY8mZQzie3Zy6As6EimiEfSGsANP+eVAwevr6EfcWN25Uywi+9TnbNCqgs16CJY0WvA93KEvwfrMkKaZZdwdCNsw8tz4wqSgvgV8hJ8qhMFX6HPT25EpLbZ98faqr5IaVH87H3m57yFDO4aHn2DE9Us4HGi4AzKPHzWTukJHdr6aDh8RC4B9K/MZzPejV+JNEkNEo6o/3MbxY+tmx6QmiPiLXq8XgyE5lHagWNMxf8pl9atFUc7tETsnjOB/9xofNzaeGqpiMv70fn984/996X4bnSuMueYJdKrK9aR5cZvH9g0pJonwZ+HG5a/Gb8Jhw2j4wzu/mLxVKEjNDW84YYPIsNWN5sR/3iZHS1Xgov1lf29eEHTg7/taF29PXU2mt1f845dtvB2c33pPouE8CG0D2fieVIfq+phP3cE0JusqA2GFGvz1+Jfzh/oxGn8MvWC8Dd5InBu2DjFhC1BVPaUWzVGTPUjtfGWENb6OwzAut75xvt9VHu7dmFQBxfWLjbB0GCl1EMx3Vx3q8TSPrdcdZo71ROijkyjj9Ydby7//JW/sfZu4RwEO5KqMSeB8j4lu2qsMsCU+zYldoQnzyALldBIx+eLbgyiLO1xObx8fkRgDVQNy9Ru9MyphnXxqqNgAUYvFR6LezjTEbOMNKWBkeuhJlWlrXE43dv4I0xeoDGCMt6NAXC5wRjZAT5mlBfJa7NpQxTNxtHCThvBl5k4f+Zdf1sY/DVNDFdEBYRQV3pt4BzZfhIAqe1Gn2hRUtw4Mgm34PYKuqR/rMKP+2l+T4Hk73GFAgO4SMZRUr0OA4f/jXgggl9pQwLShylV0w3gT4VHen+KYh8PMuHwMrpenjeuPr4ChqnuUypTQjanFSYZe4nvQiyZTg6dV84hE0kDq20/ZjxwOVDGq803e2Nv//8Tpel8HECAZUJKZ70W1d2FISiYNfacMcMLd0AotHMJACf2/f6uKY+eAGmZfx2/+yg0dDoCBekgMIt4yI4p3MHDioZjuQlXQJud790zf0D3SGfq5xEzE5PJDvOdf7vd+81c4FITVXBklvaf1KoNeFBI+V7k7Is001HkEhgicH+xKNLPtfLdE7w4bY0xeL3HkLzd7v/mr6QZeQZTfzBtzvr1iUXcBJJuJ8QVOfP8bL4RHOqTh3e8q4mgchmio148e4y//229+MwFyPq+0jMFNqiDGAIRZRkFu5q2TFsh6JP/azZHtx9e7INjqvGnXnT6OptsHdWvmQw4zZ9QkFUZAF8DNEOuqaWXI7cUc4f6r4Pp+OR368RjOf2OrAeM1JMaKW9vmSH3PJNgPCQ6YskCYvysaHBCIbhG8v77Qr+5xoB8v+Bo/N9RrF0jTz40qBKk5KQ0KVY3BMr566Cgh+PCPPj0Vtvd6PfANgi+njKqJV2UaX24M2xgW75pRpW2jcPYu/q5oEFzIQBu8cIcD3uNOrw7J9gpVE3zEpJueqzeqgQ/IiCTjt6pgdFVQL1wejMxQfwsU6PS1sPW4i8CTHwuqWpEZeFsLX6+HCfsEyCvDkcr0kqJRI1oh4MuPyI/r34S+2kzHxPEleArbYaKqIVOSdNPegMnqqFFChv6QUK8BH6l00wOdZIjw0N9U14w7TA7xgp//gcM2MUM37XLC1hhrDPJAL6WKL4gqf210XQ2kFUlJiLffyTTwJ7d+/+XpIuqgE7XkiNSu58n0q9VuIpTNqca18X36J9L2bFY2pmrw7Tr84dPT7YAu1Jg/qkgM58lyL/QJ915sfLu16Ht3QIMQ+punJXGn1uFH//EGFDk0qmVUTaioSS3ArNrtOSQxjKnIe8qtTqaaAKkJcww51+8wc3ADGMXew5cOvc/hFSLjXcFWU4X3N58M/3z9+vVRlK3O7263zjjEnxNnVSMOk1BmC1ujFlX8QN7YGtq9tm7pBcqL6Bpo50K/02ObZj5ySHTq32RDHR6j7gcaRdfoceiNO8yNMtuXUEX8cIwW1j+eWBpAjeyEvX2x3uegl1KnsLFTZp0chc3f/s2f/sd/2xlqIG/Mr0KvWBeJA7y7w+EufhEvDKCMQ2PHe/WTzJJzcHALMMskkK65+8qHrvj+Ivj+VZnln68Pois1rdyNjunBLc2dRtfspqHWFZSxmO+LdCXktoiXFbz45sfMxcZ31H3n/+VyuBLuuusuX3NMiYGmaoyI8GGvW6SmDDbMlWaf8YYL1FtWDnQD6rrgNEkhGhKrk3lO5k4YJ+Snf/qnfTEHbFDt1DNJsGD6TncfGmYDtJDHUC0eFFAArSssNRbNzRD5QoTqHE+fXWlH6G8/MOx6p8JN9R5NVNB2OOCjFs55E8dbp4DzGOtMXYpjPNH8WLsjulD5xc69zjgctjbY6F3k4/A+73M/IspBDPT1MTUwRRgVqrqZBULfH8YxdspoLIxkUGB8HHbur2vWDWWL+JaL7LOmbgShTcXxZPPtxF6obp/9vAPFDtwhreU+IK/7Ch6jwJHmel8GxrGZZVaVl3/1819vhBgJacRU4fU1SVSxX2qHbVMBgX3XzJlqPdZWodr4MjPhv6+npxd78OvlX/341xsBaBAh+ogkiD5wWu1oyhN2wUPIBrYJ8ynUxnDhnAm5vdEBKaWtbHpwpV9Glk1U8xdmKAOf+S2GxdXSd4EL5RKFyVtKnBucK55xzIjZ2kopEemRsg7OkFHx8usJGTNped8BqhcRtL/2bAPz4DKXqwai/tN1oF94OymuJ7uvM4u9gOpF/qd0ZthrT/AN87+8yzT3sraLKuok4Y4WPhRv7cFc+y6Fwx7wyrfxxqkhb9zvrabgbqqXqIaYHG8Ee8o2/lW2FgsnA1vWb3fRexJyFxJ/O5jRU+9rYJKc8qFiTo9QSAGWZuY0Dax53aEgdMt1Yulvx/bcraVWOErzIyLcR7T9RUR8BDKECrtcLpdOmoA1c0m4H6iy+8uCJBFweMgqcyzHx8fHjagKF4+hIny/3qb52CdxzGU3vHi0eAvxcbP7CIRj76fC1YS6UPhA43U8dq5zvJzSY5wjpmRH6uO0brqd36DQxBEf4ddMnC6n00kLu2Uw1N39yDl1PKXH3oKlINhYeen3s/oVLUEySnbeTqdbu1x+Pv0D8mixhOMuvkGJCI/6RIBRBL0QOB35wDOJe/xKgTmc1Fvv/YhjQi6KcrZvgEwPO5Myq+8bNf+wASTyzXzZbQ8dclUmHSlXtT2d2+pC4xmxBugoVLzRe7h2+33m6ubxfGbPJdpw6vmgGV9hmGk32qKob3NP391vrpt414d2TX1F9ohZnQ/TxKW7UvWsDd5uow+//fmCdm57BRaV3EOM67EiV+jXhfPMt+H3P+fK14fP6TxNUw7b4+iL//dZF3vFlb5p/NsPfPb2Un1mtpdH5YdeEf0P1sfF6pw8iF5Xi+u8mAdYsN6n3nKk9uDGBYQd3a2ls8Zy9RjfiCrAvt23uTrUDJoiu1GFoMP6JqIAfVwNgNaH6fpW4UmitfGDzVWDWFyn6Mm1MDDjEPMgRo0tjTGierWdTtMkVQdAE88QQ0j1dOgo+ajumPvhVSc6NfR/ZyfYVez2g8Ewxnhrjyp63avaQk/dnRDp+/vTNw5uuWyQQG8xdX/2dYeu82AnUIWIUoT46fJ6udTsvfs5qDt3v9v7hXxP6fs+1/hn5DKaFGYUve203mAyxoqwt7D/sPuHkRoIuSRqis3tBf98f1gWWjf7RHVvLBe/Jn6X5lybKeupHYR4X1o9mvZ4TIMq9Vl/RjshaBCGoz6ab4g6eMxZgx7x1Gz/5hIbS29BEMmbR38Xq7+KR+n8eYb1aQVuHzL4CELJkIjH5k5JTHFLSFqXbCYApXQICglh+w4Yj8oE/V8Usfxmxa/cXv72KeZb/F4zZKCig1zWO3XipveYrK+7SG1ZFh+B397rvlsQg4SwheY8QqohFtE5mGmJ+denZf1WX6G2DbNjDX/3jn/5TTxD1RCJgJuCBiObomvmkg0Cf/ZN2rHfspSqo6s+0BjjbXaMcWvJj7+/xxhjZFLRvU8MoeqxIMLEOqyt2rI04qpMs7GmzquTqg9TZ0s7f+T2Xk/TODiaDuF78FE1SzNe72RpxCSpyNzdujc+MnmVS68vKpUgXJew9h/p2717f3+/6UxXF9+LKxnb7LjDByMmUdkZc1K+YfT/F3n04tWvvZ6BsL0vO9xX4vbmtgsRrBW+N198B8e5ez39bMQkqjvzztK53y93xHmxR0/HGkZtHx9/WvjDD3/65pZ/9fVyf/rFPtsKgRwfm/vDesfTh9f03U1wJbsPc8ejJfIBFUDVapehp+LlOzjuFPmavrtCgj86yJgFWdclm431dginfzj/t9+xeG7U4c2KfUgg3jItTLGNGYTHPvaxl/P0fUpzjCmITb7l22MfC8xwa6bp5fB/+ZKWt9pxd5IWHFDS0IrEIXfq0QDd5cK3H+/O5iJEjqPa0NrPmZnt7u7u/fn/pyCoOJv9nJmlJONw18na5454wal3r7Pq7oQq/NPEeZdK5y0ZjAWBf7pTJfcftOMjsscSz+GwCeoo+6HEh6gCjGmpNpWz7T6/5fs+OEGbHS1T+ZUoCzXIeI28MeiG+PgIUX9CUOV+YvdxU/oJy40KPotGHmP7Jn4rFjDMmRJmLlXe0n/H3fyzmxVhcYrgbpRU3aFt236t9LR+gVHRI2OitbCuurUvmWAo4V5DJp3zz3+Hy6I+oaHy6dvhO3xw0Pa4luUCI63FcxuaZaXw6dNqA4f5CGi8dQNio9K9/968/yePef7qkz/1nIN96Z8PH3rhw0WMFYV//qd/C//h7/+bt6jmCQT7v2xjHA4Hjme77ksrxDx6TOar33Dkl8nwYzj0leAYu/M+/673+v33kz7jJdf24a2Pv3Cb9NjHvk2/3W63f6PNqvnAJZ9fLixWVYjdzCzfZ8QuqGxv6NeNgJzzGN+qmXG0SPcQePTMHjhmLuP2guLf3d580Ir3X7X07QsXF1RXU8/PDcviKOwvqOQnCpt2RxEeUOLxg58us7lzCN3IbqmqQ78fX7n4/fPgNK2I1pws20gQ26g6m+EY3gcLtAJGyUPL6j0/yAeH9Cj1JyjcbtNYg4gDP35aTYRY51rch2Ew5rGz2C7AGGOExR/ug6CkxVL+oFkQTz7ypCLAFCtJKY0ZnP92qvA/OA14PcL7YAzNlBEZ6cSw+xxEfXJZ4qBrRrcPGXoUg/nQuckUMI528PhUArZFRmN+fA+Lk+Pj47nO3Gfu/W+7GlW9zM0PYyMGB5/6u7NkLTE4HEgJ0RLFF+Chuc52ji4WxDvsLMe3Dg4G3I3Y585pXgnE3YrBRnyj3YTaDtcXmccI8f7+HrHLKPqhv+T/TkvnVGF6cEDQ/6KPGcuWs1m+2O2I92Wm2XcZSofzh3lQwEH5JtKYGadwvjvC73Up4j3ed2HzfjbHKRorym+EzwHDzAy/67rAzAznzctDrJvlJ9GyPLM2y4aOqZVToF46mYnngbTHzYFKjlrHGIOA2+RsWVw3Lx5tuJ+41yUbhWvpYd7/Zj56axNaweWue6VmzDzCja2Wmafz+eYUdIGrzrgviPY8ISi5g81y2dLHkXGY0qQK/nlWNjT7RV89yjocymIj4IaXQMPSBeFDis8Is0HavZaBN/SEyMnUXZbv/gpalkEmP3N6JI8788//q4ZZOAz0ERTCslSpV81YzjScj1FFHte+Nz7gWJ85Ej8240qP1QgMDz7W3MUsUMTlxnchwmFuBwcHLY5h7CUgzA8ZpSvTaBV3VB2znpKNe+Ld1jw8X/P4KeebqPaY9lFmPVjcjbLcCCnEx+W+u6///aYbEbTtAY7CIIg9LBzkCAjdNOy8Dd70Gd87//6t7b5WrWXTrAcSILK9I8HYlpiHDHFQeO3BvgUDNDkRVTUCYb+D8iqgTxZ2l5lqaebDHHb3aHfPtklZsgkB5p5Nwq/2m8RNxE0NpRfQHwo0gEhUjRERkz0WsjT7ZNcgW7Nr48F/84/IJpKCErOVwGmfhd3P9WCCyKKtIeIjwrRULggc7T8gVCxjNKIlfrpBSDktiZgN90BumIPHhZ3PDEwpzNwO5CM+PiLICxV8zHUPfOyNPf5h0jTCJlQOiNlwjz8xg+LZMnBiwDnb9xKICCAS8PLyUsHRIx6poBsz1Wp3/ruOlHK2R7EzR9u3heXattlORVXcP+LA+xnnTzw/TM7JRJUJzbZt20WzaDi8vPzvh9/qHuvYiGELSRyNaO04SZ4OBxLZtjsRpuraj14rLjfFtX27tZOJsDi4qbLnsx23w+Ewzh+99P2jcF6tHMLCa9kp7U81t3f5rQ739XE8mr2HvreyBUP7ho09H1q+O7IpybQY985Z9lw4V/Z8cT47H84j3+FmtC7QGTtr6QC4j5dhxw/3sE+zx8NgeJbftx+85MNDcEXbZcKOh7nn2XPe/+KLb//vX/dbe7c07X5PbFF2bzxEMFQ+wq0msZeKxGr9Wz/37//iv/zym7sTznZ8aXH7Yt5v/9c9aHfR3GDHjyI8/Wz3w6T5zcUF3L//7/2G/l4fRQUhkKi3SMEt7g5375+z/03IyK8+2XG4qdau0fhNe6BADoHzR+iTzH20JeQd/ufonKrQMSaDriZ0J9GbsIW0vjTC5qnDk+Vjsll8dAUzWSBAaOebqB7aiymt8DxiM+wcrTMHFwj0Q5xV069HTjPTfv35U0P95HC9KcT9NPsymcZngiS9sC932e3xM2E8TZYObBZ/frdCjpCcZDSCSAuldxiNLXixc7TOremlIWUHHpLexc8N94JPnxj0zTpB3dqC9pbjvePPsA2zq+1sVkY6Le4rMYDixOOHzeI1FIHQbMkNe+7JLqTaGrtG63OrHSkefNC2IKnxXpWep8nSYd8LlMxDp57tWKtZkf2W4mrsc2DTDLkOQQjzJVkAy8x+S27LYHlIMfls15gUNPCAiBRtVg7tU+sTfJ3RolEAwg/kPXA2fZk5mw1xQH5N9jpsFq5ckg+zGXegT6jgvTAMmdyQrcCwa7TUnASgaSJlN11M5vvAaZVMafGpbYGz6Yvm2Wx4r6F5ZtcBZNFciSEgNEdXiGrsuxrbMC/QwDuSYXk0xqQ0e6TYbO8Ami7pN0UsKKywncaFQyxAb7+oHWfTzfRsNvxpmDdmt9FauhaCMDsM9PCAJQWHRnMFLT1eozUg3rSjWz4D4X9PQZLV8BagCtz/acHivhW66Qpns/GxvVheW2PHlYoP7ZqEVLo9l14Y2CAmK4Z9xpwxGRp6a+nYWc5ObsGzFF4vZulAYeC55hIRIGHZ7NAMSXgvS2uyhZxbuUyIgHRpdXu/TIbNfOAszcZeksHQPk726ql5Dyg84V0JwXrAFPBNfMO5aZIAAn3ySTOTiPdhaUFnFQqhHROK6h70XpOymQ+rNwExM0zHTBcNDEL+0Nr/18mcv8hYj224PEnKzhFEB9u6KCYtCcqO8fFicZn+zdOFsHsNodtzNbYyH6yKREgxeWNASAsbgmM0PHDbyD5f9zUydSm6vVFgwFnYWGfGBZKvm+mm/7IVH/VuaWmvvoRdS0x0+7ygsJldJcM0JoHB0AyOvovtIP0A/V6+kx0h0i+skY6CChDAK9hmLm4M0cXRzcy7pWV2I6EaFbq9R6Fs2tH4LCaE9hg2K4Gjx38gDM7ZJ4Eh4/1/JzLUW1gYQKBW80OzgG3yoplp4dnCleQOXTT2eyEFP2rGZMWYTGMyGkNw9J0cNmXnr/t8fSDuhPkP8a5Qe1GAAD9/Qe8LIpLoKjIn6JafLe0RwdH+L6jN0lgp84GihBSOvovbWHkf9miKuakNWrNwbP4X7i8v2AsDRafwtUEKaWmcyU9zZwtfXjxohbKJRFjZ1jIbKAztOPoODmxln8OT9kCo/VbpdMLJehYJ0MN2Bbx2/Wqfo1pCvvbG2cK/IfMh6vJOpLCW2Zip0l3I6K39voiZ3EfZa7UWtyHABh16B0VNIiE7EEynLwqE0Nk2BJlwNr95QcQxHJfFmPuR4GmYhoyJSzaUo/0bbAwPOhx3C8OuYdr8fMPxiBPY0V16LnZ2G/AFFT4tmb4cNAfxOT1bvr1ov6WhWWHDsDCsA0KzUKK39j0GjPjPrcWBKF+YRvz2E0NdioAJkHPiq2wDuIIvu0wPpoHsnKu1MbSDDnEHNObDs4sUhULQ7X2rFWOzdBVe9FbM5YJI8bm1MDCi8cV8aHgkx6QCO+zp/XI+91CB4CSf1tao1ruBgc9p5evJ9MXSuGgO2wSBJ0kJFBfNbs9D4GBpAz3RR+MQcqO62VUBzUKJ1E0Imm37DVLf4w6Grex9UHzgK2zD0o/SzI1oMaymH4lXemufF2zD0ifGYUP0wZhsFq7VwsEAZZfAIDvT6NAb//FuO+pVEOg7ZARdMIxYRWhuw3wMH9qxivthPqTAJSu6vda71VYWrraxWihBchKSQE02i1dlxx7rijWUI2wg/F/k9noePGAdTP1ioxRfLf44x4fZE9kvKVrNYnC06xADm/l1i3WYDYSSBD3taCAmKUjKVXttGD4rTierNTIrQjg7MnwW1wPZb46tdbfr0T04AIjOdJ0JFZExc7GwWkXolo6YvFi4CoaFgQi/9/BjcjRC11yVh81MYXNJlzhm2h0UScI0m3a7hzNPrAgptRLRiAsi0XEiKtWCo9ItHOHF4lgdPJsNwuY8rjAcJ6viJ22t5avyoEW/uLHe1csGUYwLCews8wZ0u0fyZTPdMDRWE2HEh9QsBDK4dPu9C/PxRA6RmkEwNrPnyfdozSC0f6Hi6KXbYK7XY3sMwiUUaJMcTJ9c7Jpd/oBun8XYCNZBSAgERnWUL3jyPWqt3dP0I7M4n23wIEpVm9QkY/u1VZZWpbVAWYmwsKoRa2TqZfcRDoJ1mA9E+aJ59n1rOeXr5y7fhiO+eqW82f8G4EY/nTn+Q5+MN0lHX8RoA5dP0sKDdm4i6HaNyvchPMfLikCwGZwbT75fa+IziguZoctPrKkfzByPzjokzW7vHQQYn7zmzH1YmJl2LJuL5sXNRsSwYd0YiNX+C/2RVWvnoBrwDu6C9u5b7r28fQFcIOtAL7n3DB0+rXq34R6SZ1Z+jMy4araxVpYGIRuFbUDpnrwhiDtcjYm9m0M9XiAsfwejur9OV00gDdg2ZDR+dZSkvQc1cdiAs8UrUsCozXzEs0HwI+7H9WzPlleThQh7PcEJbuPLbcoior9Z+HotiCJNO9d9lBUrv9hIICzPLxa+J6LhMyIccLbXatRkoAi7fiGDFXMi4OniPikjmQtLWWfops+s60y0riojNpAeCMKjN08xc5Q3u4w3s6HChrPlFTMLBXrxk/IaQgPUzPLNy/O72TSxTwzmbFX3CPCFMrigKsribWa6IoiiiBt1edRKZtVkbLLSbAR1ybDjhdIXBL3kCMlLpCEtf5HCzs9iGahwn8SgskFARr/OVVn8JxsVGTaeoHD3IwZbRO+TWG0pROPynp8JC6uxMIwQ6vXFarP3NSb3/jWzig2PAFQR6TiRmjW38J1f2AzmkTVCioK+ST6UDF+cN6uFZT64EJGWtqU0upfWrtWXub0KCIhX3efLKaHKwLCGstA5Ru/aMThM7jtnCg7VIWuDcED2PiHE2ODsi9V8DM0wiLB4TAbiX5dtdlxtOGv3udf+cw/tSpHszqQB1O/OxaDsvno6UyK0P4fZCCOF9oUIcbbzCNNQYXnPQB0bvidHforg4KyGD2YC+22FF9aO3heV0wfeRPZUnA1PoZSMYMvV/BZSpOt5h9KM8WF+YDPb5A2l1pkhKsuE/N9HlGYRwpNM7r/gCnAUumnmHKkZZLByVdAVxvu7zmnynOSrq+WlGSVg2CYLG6OCxjz0agRf73dSj8KpR3bYRya+huVIW0NH6ilgEwZsNoiJ2ryQgoAjz6GHpaV9Cc2xmV9jTNbbLh0VhnU4XnYGGTXKkKI/9y8kPLNCZkoLz4zQHBvCFxK+8CVlrnOlGeND86B9Pinf50LroKYluFyVabdJwv6K/i908CAk+qR0iBCiFaZhUMQmgtB++iRCrBWoSTPGh+nYYB32K0FSNIGXjE91+MIp6ZnwbJI2s0tuQJLWRMeJvnZp8WEy/D1UCaR2xkoVaWmUgLFpni2uJTUrOckp30DvXEkR3fCFffckk9YBl5Olm+W35my18iXuMZGW50b0TPMxIkyHDdZhfnSFQHJSLClUEBnHRHID/AwVnVPSYYc9sH0pgCzHJKUq20whfiQYCApb+HxegM5V+xLaY9M8mwaFIHw/5qLQzklMpkkucZqQFSOUH3ey9wiXNiC6aefkMX62NI/BZ+j00vxp61iVdonQTGHo+wjk4wg7JkkYfSKISTORjfmn8FGhbPe9d6BdfoaCDV1zm4SOEmoThs+TqlhjSYwUAUXBsGmeNYsISBddaQdy0UKhY7HEKzItx1aaVkzymKkZRGua5EzxvqURF/sZ/9STGLvjSbd7ofvFETahsI0FuYrInhaOTfusXUGgCN+/jbAw9UztQJjNhqt6/uznwIZo3IPlBj1PYg/tsDmjYBwiQvu4VU8jLNxgVdrjg5Ajugq8K51yWtQg1dl36q/a0QhOk+1wERcfLhcCjY74R11+Yrl+nulP5yXhSZTpb5TpSk1q7cLRQKfTWSntC4EsgR99F3OJn7AueR/JD8uaPaXZoE9C+vHgA7/ogvbsdn7ae0yKvM7MBy6M1zD9JSYRn0NBsgmOmoOyltkSgSGE3Mr3cQrTTB9k8PdLkPrQzQb+yWpdQ8X1MB1bTrmpGSr977uw+eTlXU4Ov+boitDsX8VGDs0jq83shSCLYBv+hZiRGTqxzkxzkgBFWElGtAAAAElJKgAIAAAABgASAQMAAQAAAAEAAAAaAQUAAQAAAFYAAAAbAQUAAQAAAF4AAAAoAQMAAQAAAAIAAAATAgMAAQAAAAEAAABphwQAAQAAAGYAAAAAAAAAYAAAAAEAAABgAAAAAQAAAAYAAJAHAAQAAAAwMjEwAZEHAAQAAAABAgMAAKAHAAQAAAAwMTAwAaADAAEAAAD//wAAAqAEAAEAAAAAAQAAA6AEAAEAAAAAAQAAAAAAAFhNUCCxBQAAPD94cGFja2V0IGJlZ2luPSfvu78nIGlkPSdXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQnPz4KPHg6eG1wbWV0YSB4bWxuczp4PSdhZG9iZTpuczptZXRhLyc+CjxyZGY6UkRGIHhtbG5zOnJkZj0naHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyc+CgogPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9JycKICB4bWxuczpBdHRyaWI9J2h0dHA6Ly9ucy5hdHRyaWJ1dGlvbi5jb20vYWRzLzEuMC8nPgogIDxBdHRyaWI6QWRzPgogICA8cmRmOlNlcT4KICAgIDxyZGY6bGkgcmRmOnBhcnNlVHlwZT0nUmVzb3VyY2UnPgogICAgIDxBdHRyaWI6Q3JlYXRlZD4yMDI2LTAyLTExPC9BdHRyaWI6Q3JlYXRlZD4KICAgICA8QXR0cmliOkRhdGE+eyZxdW90O2RvYyZxdW90OzomcXVvdDtEQUhCQ0hWWmdMVSZxdW90OywmcXVvdDt1c2VyJnF1b3Q7OiZxdW90O1VBQ2R3SGRXQUYwJnF1b3Q7LCZxdW90O2JyYW5kJnF1b3Q7OiZxdW90O1ZlcnRpYzMmcXVvdDssJnF1b3Q7dGVtcGxhdGUmcXVvdDs6JnF1b3Q7Qmx1ZSBNb2Rlcm4gUHJvZmVzc2lvbmFsIExldHRlciBLIExvZ28mcXVvdDt9PC9BdHRyaWI6RGF0YT4KICAgICA8QXR0cmliOkV4dElkPjkyMWU4NTA5LTFkZTYtNDI5Yy1iZTQ2LTQ5OWU3OTlmNDA1YjwvQXR0cmliOkV4dElkPgogICAgIDxBdHRyaWI6RmJJZD41MjUyNjU5MTQxNzk1ODA8L0F0dHJpYjpGYklkPgogICAgIDxBdHRyaWI6VG91Y2hUeXBlPjI8L0F0dHJpYjpUb3VjaFR5cGU+CiAgICA8L3JkZjpsaT4KICAgPC9yZGY6U2VxPgogIDwvQXR0cmliOkFkcz4KIDwvcmRmOkRlc2NyaXB0aW9uPgoKIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PScnCiAgeG1sbnM6ZGM9J2h0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvJz4KICA8ZGM6dGl0bGU+CiAgIDxyZGY6QWx0PgogICAgPHJkZjpsaSB4bWw6bGFuZz0neC1kZWZhdWx0Jz5mYXZpY29uLTI1NiAtIEljb25vIFBlc3Nhcm8gQ2FwaXRhbCA8L3JkZjpsaT4KICAgPC9yZGY6QWx0PgogIDwvZGM6dGl0bGU+CiA8L3JkZjpEZXNjcmlwdGlvbj4KCiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0nJwogIHhtbG5zOnBkZj0naHR0cDovL25zLmFkb2JlLmNvbS9wZGYvMS4zLyc+CiAgPHBkZjpBdXRob3I+RnJhbmNpc2NvIFJvamFzPC9wZGY6QXV0aG9yPgogPC9yZGY6RGVzY3JpcHRpb24+CgogPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9JycKICB4bWxuczp4bXA9J2h0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8nPgogIDx4bXA6Q3JlYXRvclRvb2w+Q2FudmEgZG9jPURBSEJDSFZaZ0xVIHVzZXI9VUFDZHdIZFdBRjAgYnJhbmQ9VmVydGljMyB0ZW1wbGF0ZT1CbHVlIE1vZGVybiBQcm9mZXNzaW9uYWwgTGV0dGVyIEsgTG9nbzwveG1wOkNyZWF0b3JUb29sPgogPC9yZGY6RGVzY3JpcHRpb24+CjwvcmRmOlJERj4KPC94OnhtcG1ldGE+Cjw/eHBhY2tldCBlbmQ9J3InPz4A"

const TEMPLATES=[
  {id:'bienvenida_lead',     label:'Bienvenida lead',       color:P.purple, desc:'Primer contacto tras registro'},
  {id:'seguimiento_lead',    label:'Seguimiento',           color:P.blue,   desc:'Follow-up personalizable'},
  {id:'invitacion_radex',    label:'Invitación Radex',      color:'#e74c3c',desc:'Apertura cuenta Radex'},
  {id:'invitacion_tradeview',label:'Invitación Tradeview',  color:'#3498db',desc:'Apertura cuenta Tradeview'},
  {id:'deposito_confirmado', label:'Depósito confirmado',   color:P.green,  desc:'Confirmación con acceso al portal'},
  {id:'informe_trimestral',  label:'Informe trimestral',    color:'#f0a500',desc:'Resultados Q1 2026 con métricas'},
  {id:'accesos_crm',         label:'Accesos CRM',           color:'#2563eb',desc:'Entrega de credenciales provisionales al equipo'},
  {id:'personalizado',       label:'Personalizado',         color:P.muted,  desc:'Asunto y cuerpo libres'},
]

const fmt    = n => new Intl.NumberFormat('es-CL',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n||0)
const fmtDate= d => d ? new Date(d).toLocaleDateString('es-CL') : '—'
const uid    = () => Math.random().toString(36).slice(2,9)

// ─── BASE COMPONENTS ──────────────────────────────────────────────────────────
function Badge({label,color}){
  return <span style={{display:'inline-block',padding:'2px 8px',borderRadius:4,fontSize:10,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',background:color+'20',color,border:`1px solid ${color}35`}}>{label}</span>
}
function GlassCard({children,style={},accent}){
  return <div style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:14,padding:20,position:'relative',overflow:'hidden',...style}}>
    {accent&&<div style={{position:'absolute',top:-30,right:-30,width:100,height:100,background:`radial-gradient(circle,${accent}25,transparent 70%)`,borderRadius:'50%',pointerEvents:'none'}}/>}
    {children}
  </div>
}
function StatCard({label,value,sub,Icon,accent=P.purple}){
  return <GlassCard accent={accent} style={{flex:1,minWidth:150}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
      <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',margin:0}}>{label}</p>
      <div style={{width:28,height:28,borderRadius:8,background:accent+'22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13}}>{Icon}</div>
    </div>
    <div style={{display:'inline-flex',background:accent+'18',border:`1px solid ${accent}35`,borderRadius:8,padding:'5px 12px',marginBottom:sub?6:0}}>
      <span style={{fontSize:16,fontWeight:700,color:accent,fontFamily:"'JetBrains Mono',monospace"}}>{value}</span>
    </div>
    {sub&&<p style={{fontSize:11,color:P.muted,marginTop:4,margin:'4px 0 0'}}>{sub}</p>}
  </GlassCard>
}
function Input({value,onChange,placeholder,type='text',style={}}){
  return <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8,padding:'9px 12px',color:P.text,fontSize:13,outline:'none',width:'100%',fontFamily:'inherit',...style}}/>
}
function Sel({value,onChange,options,style={}}){
  return <select value={value} onChange={e=>onChange(e.target.value)}
    style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8,padding:'9px 12px',color:P.text,fontSize:13,outline:'none',width:'100%',fontFamily:'inherit',...style}}>
    {options.map(o=><option key={o.value} value={o.value} style={{background:P.surface}}>{o.label}</option>)}
  </select>
}
function Btn({children,onClick,variant='primary',style={},disabled=false}){
  const vs={
    primary:{background:`linear-gradient(135deg,#7c6fee,${P.purple})`,color:'#fff',border:'none',fontWeight:600,boxShadow:`0 4px 14px ${P.purple}40`},
    ghost:{background:'rgba(255,255,255,0.04)',color:P.textSub,border:`1px solid ${P.border}`,fontWeight:500},
    blue:{background:`linear-gradient(135deg,#1a9bff,${P.blue})`,color:'#fff',border:'none',fontWeight:600},
    danger:{background:P.redDim,color:P.red,border:`1px solid ${P.red}35`,fontWeight:500},
    green:{background:P.greenDim,color:P.green,border:`1px solid ${P.green}35`,fontWeight:600},
  }
  return <button onClick={onClick} disabled={disabled}
    style={{padding:'9px 16px',borderRadius:8,fontSize:13,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.5:1,display:'inline-flex',alignItems:'center',gap:6,...vs[variant],...style}}>{children}</button>
}
function Modal({title,onClose,children,accent=P.purple}){
  return <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20}}>
    <div style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:16,width:'100%',maxWidth:540,maxHeight:'90vh',overflow:'auto',boxShadow:'0 25px 60px rgba(0,0,0,0.6)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'18px 24px',borderBottom:`1px solid ${P.border}`}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:8,height:8,borderRadius:'50%',background:accent}}/><h3 style={{margin:0,fontSize:16,fontWeight:700,color:P.text}}>{title}</h3></div>
        <button onClick={onClose} style={{background:'none',border:'none',color:P.muted,cursor:'pointer',fontSize:20}}>✕</button>
      </div>
      <div style={{padding:24}}>{children}</div>
    </div>
  </div>
}
function Lbl({children}){return <label style={{fontSize:11,color:P.muted,display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600}}>{children}</label>}
function Spinner(){return <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:60}}><div style={{width:28,height:28,border:`3px solid ${P.border}`,borderTop:`3px solid ${P.purple}`,borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/></div>}
function SHdr({title,sub,action}){
  return <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24}}>
    <div><h2 style={{fontSize:20,fontWeight:700,color:P.text,marginBottom:4,margin:'0 0 4px'}}>{title}</h2>{sub&&<p style={{fontSize:13,color:P.muted,margin:0}}>{sub}</p>}</div>
    {action}
  </div>
}
const TT={contentStyle:{background:P.surface,border:`1px solid ${P.border}`,borderRadius:8,color:P.text,fontSize:12}}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login({onLogin}){
  const[email,setEmail]=useState('')
  const[pass,setPass]=useState('')
  const[error,setError]=useState('')
  const[loading,setLoading]=useState(false)
  const handle=async()=>{
    if(!email||!pass)return
    setLoading(true);setError('')
    const{data,error:err}=await supabase.auth.signInWithPassword({email,password:pass})
    setLoading(false)
    if(err){setError(err.message);return}
    onLogin(data.user)
  }
  return <div style={{minHeight:'100vh',background:P.bg,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
    <div style={{width:'100%',maxWidth:380}}>
      <div style={{textAlign:'center',marginBottom:36}}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:16}}>
          <img src={LOGO_URI} width={52} height={52} style={{borderRadius:10,display:'block'}} alt="Pessaro"/>
        </div>
        <h1 style={{fontSize:22,fontWeight:800,color:P.text,margin:'0 0 4px'}}>Pessaro Capital</h1>
        <p style={{color:P.purple,fontWeight:600,fontSize:14,letterSpacing:'0.08em',textTransform:'uppercase',margin:'0 0 6px'}}>CRM Interno</p>
        <p style={{color:P.muted,fontSize:13,margin:0}}>Acceso exclusivo para el equipo</p>
      </div>
      <GlassCard accent={P.purple}>
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div><Lbl>Email</Lbl><Input value={email} onChange={setEmail} placeholder="tu@pessaro.cl" type="email"/></div>
          <div><Lbl>Contraseña</Lbl><Input value={pass} onChange={setPass} placeholder="••••••••" type="password"/></div>
          {error&&<div style={{fontSize:12,color:P.red,background:P.redDim,padding:'10px 12px',borderRadius:8,border:`1px solid ${P.red}30`}}>{error}</div>}
          <Btn onClick={handle} disabled={loading} style={{width:'100%',justifyContent:'center',padding:11}}>{loading?'Ingresando...':'Entrar al CRM'}</Btn>
        </div>
      </GlassCard>
      <p style={{textAlign:'center',marginTop:14,fontSize:11,color:P.muted}}>Usa tu cuenta de Pessaro Capital</p>
    </div>
  </div>
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({contacts,leads,onNav}){
  const closed=leads.filter(l=>l.etapa===5).length
  const newC=contacts.filter(c=>c.status==='new').length
  const totalCap=contacts.reduce((s,c)=>s+(Number(c.investment_capital)||0),0)
  const pipeData=STAGES.map(s=>({name:STAGE_LABEL[s],v:leads.filter(l=>ETAPA_STAGE[l.etapa]===s).length}))
  return <div>
    <SHdr title="Dashboard" sub="Datos en tiempo real desde Supabase"/>
    <div style={{display:'flex',gap:14,marginBottom:22,flexWrap:'wrap'}}>
      <StatCard label="Formularios" value={contacts.length} sub={newC>0?`${newC} sin leer`:contacts.length>0?'Todos leídos ✓':'Sin formularios'} accent={newC>0?P.orange:P.purple} Icon="📋"/>
      <StatCard label="Leads pipeline" value={leads.length} sub={`${closed} cerrados`} accent={P.blue} Icon="◈"/>
      <StatCard label="Capital declarado" value={fmt(totalCap)} accent={P.green} Icon="💵"/>
      <StatCard label="Tasa cierre" value={leads.length?`${Math.round(closed/leads.length*100)}%`:'—'} accent={P.orange} Icon="🎯"/>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,marginBottom:18}}>
      <GlassCard>
        <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:16,margin:'0 0 16px'}}>Pipeline por etapa</p>
        <ErrorBoundary><ResponsiveContainer width="100%" height={180}>
          <BarChart data={pipeData} barSize={28}><XAxis dataKey="name" tick={{fill:P.muted,fontSize:10}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip {...TT} formatter={v=>[v,'Leads']}/><Bar dataKey="v" fill={P.purple} radius={[4,4,0,0]}/></BarChart>
        </ResponsiveContainer></ErrorBoundary>
      </GlassCard>
      <GlassCard>
        <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:16,margin:'0 0 16px'}}>Estado formularios</p>
        {[['new','Sin leer',P.orange],['read','Leídos',P.blue],['replied','Respondidos',P.green],['archived','Archivados / Spam',P.muted]].map(([s,l,c])=>{
          const cnt=contacts.filter(x=>x.status===s).length
          return <div key={s} style={{marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{fontSize:13,color:P.textSub}}>{l}</span><span style={{fontSize:13,fontFamily:'monospace',color:c,fontWeight:600}}>{cnt}</span></div>
            <div style={{background:'rgba(255,255,255,0.06)',borderRadius:2,height:4}}><div style={{background:c,height:4,borderRadius:2,width:`${contacts.length?cnt/contacts.length*100:0}%`,transition:'width 0.6s'}}/></div>
          </div>
        })}
      </GlassCard>
    </div>
    <GlassCard>
      <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:16,margin:'0 0 16px'}}>Últimos formularios</p>
      {contacts.filter(c=>c.status!=='archived').slice(0,6).map((c,i)=>(
        <div key={c.id} onClick={()=>onNav('contacts')} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:i<5?`1px solid ${P.border}`:'none',cursor:'pointer',borderRadius:6}} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            <div style={{width:30,height:30,borderRadius:8,background:P.purpleDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:P.purple}}>{(c.full_name||'?')[0]}</div>
            <div><p style={{fontSize:13,fontWeight:600,color:P.text,margin:0}}>{c.full_name}</p><p style={{fontSize:11,color:P.muted,margin:0}}>{c.email}</p></div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {c.investment_capital>0&&<span style={{fontSize:12,fontFamily:'monospace',color:P.green}}>{fmt(c.investment_capital)}</span>}
            <Badge label={c.status} color={STATUS_COLOR[c.status]||P.muted}/>
          </div>
        </div>
      ))}
      {contacts.length===0&&<p style={{color:P.muted,fontSize:13,margin:0}}>Sin formularios aún</p>}
    </GlassCard>
  </div>
}

// ─── CONTACTS (SUPER ADMIN = todos, asesor = propios) ─────────────────────────
function Contacts({user,isSuperAdmin}){
  const isSARef=useRef(isSuperAdmin)
  useEffect(()=>{isSARef.current=isSuperAdmin},[isSuperAdmin])
  const[contacts,setContacts]=useState([])
  const[loading,setLoading]=useState(true)
  const[search,setSearch]=useState('')
  const[statusFilter,setStatusFilter]=useState('todos')
  const[staffList,setStaffList]=useState([])
  const[userFilter,setUserFilter]=useState('todos')
  const[tab,setTab]=useState('lista')
  const[selected,setSelected]=useState(null)
  const[notes,setNotes]=useState([])
  const[noteText,setNoteText]=useState('')
  const[form,setForm]=useState({full_name:'',email:'',phone:'',address:'',status:'activo',notes:''})
  const[formErr,setFormErr]=useState({})
  const[saving,setSaving]=useState(false)
  const[csvRows,setCsvRows]=useState([])
  const[csvErrors,setCsvErrors]=useState([])
  const[csvImporting,setCsvImporting]=useState(false)
  const[csvDone,setCsvDone]=useState(null)
  const[dragOver,setDragOver]=useState(false)

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      if(isSARef.current){
        // Super admin: crm_contacts + contact_submissions fusionados
        const[{data:crm},{data:subs},{data:sp}]=await Promise.all([
          supabase.from('crm_contacts').select('*').order('created_at',{ascending:false}),
          supabase.from('contact_submissions').select('id,full_name,email,mobile,investment_capital,management_type,status,submitted_at').order('submitted_at',{ascending:false}),
          supabase.from('crm_staff_profiles').select('user_id,display_name'),
        ])
        setStaffList(sp||[])
        const existing=new Set((crm||[]).map(c=>c.email))
        const normalized=(subs||[]).filter(s=>!existing.has(s.email)).map(s=>({
          id:'sub_'+s.id, user_id:null,
          full_name:s.full_name||'Sin nombre', email:s.email, phone:s.mobile||'—', address:'',
          notes:s.management_type||'', status:s.status==='new'?'prospecto':s.status==='read'?'activo':s.status==='replied'?'cliente':'inactivo',
          _origStatus:s.status, source:'formulario', created_at:s.submitted_at, _capital:s.investment_capital,
        }))
        setContacts([...(crm||[]),...normalized])
      } else {
        const{data}=await supabase.from('crm_contacts').select('*').eq('user_id',user.id).order('created_at',{ascending:false})
        setContacts(data||[])
      }
    }catch(e){console.error('contacts load:',e)}
    finally{setLoading(false)}
  },[user.id])

  useEffect(()=>{load()},[load])

  const filtered=contacts.filter(c=>{
    const ms=`${c.full_name} ${c.email} ${c.phone}`.toLowerCase().includes(search.toLowerCase())
    const mst=statusFilter==='todos'||(statusFilter==='activos'&&c.status!=='inactivo')||c.status===statusFilter
    const mu=userFilter==='todos'||c.user_id===userFilter
    return ms&&mst&&mu
  })

  const validate=()=>{
    const e={}
    if(!form.full_name.trim())e.full_name='Obligatorio'
    if(!form.email.trim()||!form.email.includes('@'))e.email='Email válido obligatorio'
    if(!form.phone.trim())e.phone='Obligatorio'
    setFormErr(e); return !Object.keys(e).length
  }

  const saveContact=async()=>{
    if(!validate())return
    setSaving(true)
    const{data,error}=await supabase.from('crm_contacts').insert({...form,user_id:user.id,source:'manual'}).select().single()
    setSaving(false)
    if(error){setFormErr({email:error.message});return}
    setContacts(p=>[data,...p])
    setForm({full_name:'',email:'',phone:'',address:'',status:'activo',notes:''})
    setFormErr({});setTab('lista')
  }

  const openContact=async c=>{
    setSelected(c);setNotes([]);setNoteText('')
    try{
      let q=supabase.from('crm_notes').select('*').order('created_at',{ascending:false})
      if(c.id.startsWith('sub_')) q=q.eq('contact_submission_id',c.id.replace('sub_',''))
      else q=q.eq('crm_contact_id',c.id)
      const{data}=await q
      setNotes(data||[])
    }catch(e){console.error('loadNotes:',e)}
    if(c.source==='formulario'&&c._origStatus==='new'){
      try{
        await supabase.from('contact_submissions').update({status:'read'}).eq('id',c.id.replace('sub_',''))
        setContacts(p=>p.map(x=>x.id===c.id?{...x,status:'activo',_origStatus:'read'}:x))
        setSelected(s=>s?{...s,status:'activo',_origStatus:'read'}:s)
      }catch(e){console.error('markRead:',e)}
    }
  }

  const addNote=async()=>{
    if(!noteText.trim()||!selected)return
    const isSub=selected.id.startsWith('sub_')
    const payload={content:noteText}
    if(isSub) payload.contact_submission_id=selected.id.replace('sub_','')
    else payload.crm_contact_id=selected.id
    const{data,error}=await supabase.from('crm_notes').insert(payload).select().single()
    if(error){console.error('addNote:',error);return}
    if(data){setNotes(p=>[data,...p]);setNoteText('')}
  }

  const updateStatus=async(id,status)=>{
    try{
      if(id.startsWith('sub_')){
        const subStatus=status==='activo'?'read':status==='cliente'?'replied':status==='inactivo'?'archived':'new'
        await supabase.from('contact_submissions').update({status:subStatus}).eq('id',id.replace('sub_',''))
      } else {
        await supabase.from('crm_contacts').update({status}).eq('id',id)
      }
      const orig=status==='activo'?'read':status==='cliente'?'replied':status==='inactivo'?'archived':'new'
      setContacts(p=>p.map(c=>c.id===id?{...c,status,_origStatus:orig}:c))
      if(selected?.id===id)setSelected(p=>({...p,status}))
    }catch(e){console.error('updateStatus:',e)}
  }

  const parseCSV=text=>{
    const lines=text.trim().split('\n')
    if(lines.length<2)return{rows:[],errors:['El CSV debe tener encabezado y al menos una fila']}
    const headers=lines[0].split(",").map(h=>h.trim().toLowerCase().replace(/['"]/g,""))
    const ni=headers.findIndex(h=>/nombre|name|full_name/.test(h))
    const ei=headers.findIndex(h=>/correo|email/.test(h))
    const pi=headers.findIndex(h=>/tel|phone|movil|móvil/.test(h))
    const ai=headers.findIndex(h=>/dir|address/.test(h))
    const errs=[]
    if(ni<0)errs.push('Columna "nombre" no encontrada')
    if(ei<0)errs.push('Columna "correo/email" no encontrada')
    if(pi<0)errs.push('Columna "telefono" no encontrada')
    if(errs.length)return{rows:[],errors:errs}
    const rows=[];
    lines.slice(1).forEach((line,i)=>{
      const cols=line.split(',').map(c=>c.trim().replace(/^"|"$/g,''))
      const n=cols[ni]||'',e=cols[ei]||'',p=cols[pi]||''
      if(!n||!e||!p){errs.push(`Fila ${i+2}: faltan campos`);return}
      rows.push({full_name:n,email:e,phone:p,address:ai>=0?cols[ai]||'':'',status:'activo',source:'csv'})
    })
    return{rows,errors:errs}
  }

  const handleCSVFile=async file=>{
    if(!file)return
    const text=await file.text()
    const{rows,errors}=parseCSV(text)
    setCsvRows(rows);setCsvErrors(errors);setCsvDone(null)
  }

  const importCSV=async()=>{
    if(!csvRows.length)return
    setCsvImporting(true)
    const{data,error}=await supabase.from('crm_contacts').insert(csvRows.map(r=>({...r,user_id:user.id}))).select()
    setCsvImporting(false)
    if(error){setCsvErrors([error.message]);return}
    setContacts(p=>[...(data||[]),...p])
    setCsvDone(`✓ ${data?.length||0} contactos importados`)
    setCsvRows([]);setCsvErrors([])
  }

  const getAdvisorName=uid=>staffList.find(s=>s.user_id===uid)?.display_name||'Asesor'

  return <div>
    <SHdr title={isSuperAdmin?'Todos los Contactos':'Mis Contactos'}
      sub={isSuperAdmin?`${filtered.length} de ${contacts.length} · CRM + formularios web`:`${contacts.length} contactos propios`}
      action={<div style={{display:'flex',gap:8}}>
        <Btn variant="ghost" onClick={()=>load()} style={{fontSize:11,padding:'6px 10px'}} title="Recargar contactos">⟳ Recargar</Btn>
        {isSuperAdmin&&<div style={{display:'flex',gap:6}}>
          <Btn variant="ghost" onClick={()=>exportContactsCSV(filtered)} style={{fontSize:11,padding:'6px 10px'}}>⬇ CSV</Btn>
          <Btn variant="ghost" onClick={()=>exportContactsExcel(filtered)} style={{fontSize:11,padding:'6px 10px'}}>⬇ Excel</Btn>
          <Btn variant="ghost" onClick={()=>exportContactsHTML(filtered)} style={{fontSize:11,padding:'6px 10px'}}>⬇ HTML</Btn>
          <Btn onClick={()=>exportContactsPDF(filtered,LOGO_URI)} style={{fontSize:11,padding:'6px 10px',background:'linear-gradient(135deg,#0a1f5c,#2563eb)',color:'#fff',border:'none'}}>⬇ PDF</Btn>
        </div>}
        {isSuperAdmin&&contacts.filter(c=>c._origStatus==='new').length>0&&<Btn variant="ghost" onClick={async()=>{
          const newIds=contacts.filter(c=>c._origStatus==='new'&&c.id.startsWith('sub_')).map(c=>c.id.replace('sub_',''))
          if(!newIds.length)return
          await supabase.from('contact_submissions').update({status:'read'}).in('id',newIds)
          setContacts(p=>p.map(c=>c._origStatus==='new'?{...c,status:'activo',_origStatus:'read'}:c))
        }} style={{fontSize:12}}>✓ Marcar todos leídos ({contacts.filter(c=>c._origStatus==='new').length})</Btn>}
        <Btn variant="ghost" onClick={()=>setTab(tab==='csv'?'lista':'csv')}>📂 CSV</Btn>
        <Btn onClick={()=>setTab(tab==='nuevo'?'lista':'nuevo')}>+ Nuevo</Btn>
      </div>}/>

    {tab==='nuevo'&&<GlassCard accent={P.purple} style={{marginBottom:20}}>
      <p style={{fontWeight:700,color:P.text,marginBottom:18,margin:'0 0 18px'}}>Nuevo contacto</p>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        {[['full_name','Nombre completo *','Juan García'],['email','Email *','juan@empresa.com'],['phone','Teléfono *','+56 9...']].map(([f,l,p])=>(
          <div key={f}>
            <Lbl>{l}</Lbl>
            <Input value={form[f]} onChange={v=>setForm(x=>({...x,[f]:v}))} placeholder={p} type={f==='email'?'email':'text'}
              style={formErr[f]?{border:`1px solid ${P.red}`}:{}}/>
            {formErr[f]&&<p style={{fontSize:11,color:P.red,marginTop:3,margin:'3px 0 0'}}>{formErr[f]}</p>}
          </div>
        ))}
        <div><Lbl>Estado</Lbl><Sel value={form.status} onChange={v=>setForm(p=>({...p,status:v}))} options={STATUS_OPT}/></div>
        <div style={{gridColumn:'1/-1'}}><Lbl>Dirección (opcional)</Lbl><Input value={form.address} onChange={v=>setForm(p=>({...p,address:v}))} placeholder="Av. Ejemplo 123"/></div>
        <div style={{gridColumn:'1/-1'}}><Lbl>Notas (opcional)</Lbl>
          <textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Notas internas..."
            style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8,padding:10,color:P.text,fontSize:13,outline:'none',width:'100%',minHeight:60,resize:'vertical',fontFamily:'inherit'}}/>
        </div>
      </div>
      <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:16}}>
        <Btn variant="ghost" onClick={()=>setTab('lista')}>Cancelar</Btn>
        <Btn onClick={saveContact} disabled={saving}>{saving?'Guardando...':'Guardar'}</Btn>
      </div>
    </GlassCard>}

    {tab==='csv'&&<GlassCard accent={P.blue} style={{marginBottom:20}}>
      <p style={{fontWeight:700,color:P.text,marginBottom:6,margin:'0 0 6px'}}>Importar CSV</p>
      <p style={{fontSize:12,color:P.muted,marginBottom:14,margin:'0 0 14px'}}>Columnas requeridas: <strong style={{color:P.text}}>nombre, correo, telefono</strong> · opcional: direccion</p>
      <div style={{display:'flex',gap:10,marginBottom:14}}>
        <button onClick={()=>{const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent('nombre,correo,telefono,direccion\nJuan García,juan@ejemplo.com,+56912345678,Av. Ejemplo 123');a.download='plantilla.csv';a.click()}}
          style={{fontSize:12,color:P.blue,background:P.blueDim,border:`1px solid ${P.blue}30`,borderRadius:6,padding:'5px 12px',cursor:'pointer'}}>⬇ Plantilla CSV</button>
      </div>
      <div onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)}
        onDrop={e=>{e.preventDefault();setDragOver(false);handleCSVFile(e.dataTransfer.files[0])}}
        style={{border:`2px dashed ${dragOver?P.blue:P.border}`,borderRadius:10,padding:'20px',textAlign:'center',background:dragOver?P.blueDim:'rgba(255,255,255,0.02)',cursor:'pointer',marginBottom:12}}
        onClick={()=>document.getElementById('csvInput').click()}>
        <p style={{fontSize:14,color:P.textSub,margin:0}}>📂 Arrastra tu CSV o <span style={{color:P.blue,fontWeight:600}}>haz clic</span></p>
        <input id="csvInput" type="file" accept=".csv" style={{display:'none'}} onChange={e=>handleCSVFile(e.target.files[0])}/>
      </div>
      {csvErrors.length>0&&<div style={{marginBottom:10,padding:'10px',background:P.redDim,borderRadius:8}}>{csvErrors.map((e,i)=><p key={i} style={{fontSize:12,color:P.red,margin:'2px 0'}}>{e}</p>)}</div>}
      {csvRows.length>0&&<div>
        <p style={{fontSize:12,color:P.muted,marginBottom:8,margin:'0 0 8px'}}>{csvRows.length} contactos listos</p>
        {csvDone&&<div style={{marginBottom:10,padding:'8px 12px',background:P.greenDim,border:`1px solid ${P.green}30`,borderRadius:8}}><p style={{fontSize:13,color:P.green,margin:0}}>{csvDone}</p></div>}
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <Btn variant="ghost" onClick={()=>{setCsvRows([]);setCsvErrors([]);setCsvDone(null)}}>Cancelar</Btn>
          <Btn variant="blue" onClick={importCSV} disabled={csvImporting}>{csvImporting?'Importando...':'Importar '+csvRows.length}</Btn>
        </div>
      </div>}
    </GlassCard>}

    <div style={{display:'flex',gap:10,marginBottom:16}}>
      <Input value={search} onChange={setSearch} placeholder="Buscar nombre, email o teléfono..." style={{maxWidth:300}}/>
      <Sel value={statusFilter} onChange={setStatusFilter} style={{maxWidth:160}} options={[{value:'todos',label:'Todos (incl. spam)'},{value:'activos',label:'Activos (excl. spam)'},...STATUS_OPT]}/>
      {isSuperAdmin&&staffList.length>0&&<Sel value={userFilter} onChange={setUserFilter} style={{maxWidth:200}} options={[{value:'todos',label:'Todos los asesores'},...staffList.map(s=>({value:s.user_id,label:s.display_name}))]}/>}
      <Btn variant="ghost" onClick={load} style={{padding:'9px 12px'}}>↺</Btn>
    </div>

    {loading?<Spinner/>:<GlassCard style={{padding:0}}>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead><tr style={{borderBottom:`1px solid ${P.border}`}}>
          {[...(isSuperAdmin?['Asesor']:[]),(isSuperAdmin?'Capital':''),'Nombre','Email','Teléfono','Estado','Origen',''].filter(Boolean).map(h=>(
            <th key={h} style={{padding:'12px 18px',textAlign:'left',fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',fontWeight:600}}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {filtered.map((c,i)=>(
            <tr key={c.id} style={{borderBottom:i<filtered.length-1?`1px solid ${P.border}`:'none',cursor:'pointer',transition:'background 0.12s'}}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.025)'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}
              onClick={()=>openContact(c)}>
              {isSuperAdmin&&<td style={{padding:'12px 18px'}}><span style={{fontSize:11,color:P.purple,background:P.purpleDim,borderRadius:4,padding:'2px 8px'}}>{c.user_id?getAdvisorName(c.user_id):'Web'}</span></td>}
              {isSuperAdmin&&<td style={{padding:'12px 18px',fontSize:12,color:P.green,fontFamily:'monospace',fontWeight:600}}>{c._capital>0?fmt(c._capital):'—'}</td>}
              <td style={{padding:'12px 18px'}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:30,height:30,borderRadius:8,background:P.purpleDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:P.purple,flexShrink:0}}>{(c.full_name||'?')[0]}</div>
                  <span style={{fontSize:13,fontWeight:600,color:P.text}}>{c.full_name}</span>
                </div>
              </td>
              <td style={{padding:'12px 18px',color:P.muted,fontSize:12,fontFamily:'monospace'}}>{c.email}</td>
              <td style={{padding:'12px 18px',color:P.muted,fontSize:12}}>{c.phone}</td>
              <td style={{padding:'12px 18px'}}><Badge label={c.status} color={SCOLOR_MAP[c.status]||P.muted}/></td>
              <td style={{padding:'12px 18px'}}><div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}><Badge label={c.source||'crm'} color={c.source==='csv'?P.blue:c.source==='formulario'?P.orange:P.muted}/>{c._origStatus==='new'&&<Badge label="nuevo" color={P.orange}/>}</div></td>
              <td style={{padding:'12px 18px'}}><Btn variant="ghost" style={{padding:'4px 10px',fontSize:11}}>Ver →</Btn></td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length===0&&<div style={{textAlign:'center',padding:48,color:P.muted,fontSize:13}}>{contacts.length===0?'Aún no tienes contactos. Añade uno o importa un CSV.':'Sin resultados.'}</div>}
    </GlassCard>}

    {selected&&<Modal title={selected.full_name} onClose={()=>setSelected(null)}>
      <div>
        <div style={{display:'flex',gap:8,marginBottom:18,flexWrap:'wrap'}}>
          <Badge label={selected.status} color={SCOLOR_MAP[selected.status]||P.muted}/>
          <Badge label={selected.source||'crm'} color={selected.source==='formulario'?P.orange:selected.source==='csv'?P.blue:P.muted}/>
          {selected._capital>0&&<span style={{fontSize:13,color:P.green,fontFamily:'monospace',fontWeight:700}}>{fmt(selected._capital)}</span>}
        </div>
        {[['Email',selected.email],['Teléfono',selected.phone],['Dirección',selected.address||'—'],['Registro',fmtDate(selected.created_at)]].map(([k,v])=>(
          <div key={k} style={{paddingBottom:12,marginBottom:12,borderBottom:`1px solid ${P.border}`}}>
            <p style={{fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:4,margin:'0 0 4px',fontWeight:600}}>{k}</p>
            <p style={{fontSize:13,color:P.text,margin:0}}>{v}</p>
          </div>
        ))}
        <div style={{marginBottom:18}}>
          <Lbl>Cambiar estado</Lbl>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {STATUS_OPT.map(s=>(
              <button key={s.value} onClick={()=>updateStatus(selected.id,s.value)}
                style={{padding:'5px 12px',borderRadius:6,fontSize:11,cursor:'pointer',fontWeight:600,
                  background:selected.status===s.value?SCOLOR_MAP[s.value]+'30':'rgba(255,255,255,0.04)',
                  color:selected.status===s.value?SCOLOR_MAP[s.value]:P.muted,
                  border:`1px solid ${selected.status===s.value?SCOLOR_MAP[s.value]+'50':P.border}`}}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p style={{fontSize:10,fontWeight:700,color:P.purple,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:10,margin:'0 0 10px'}}>Notas ({notes.length})</p>
          {notes.map(n=><div key={n.id} style={{padding:'10px 12px',marginBottom:8,background:'rgba(108,92,231,0.08)',borderRadius:8,borderLeft:`3px solid ${P.purple}`}}>
            <p style={{fontSize:13,color:P.textSub,margin:'0 0 4px',lineHeight:1.6}}>{n.content}</p>
            <p style={{fontSize:10,color:P.muted,margin:0}}>{fmtDate(n.created_at)}</p>
          </div>)}
          <div style={{display:'flex',gap:8,marginTop:10}}>
            <Input value={noteText} onChange={setNoteText} placeholder="Añadir nota..." style={{flex:1}}/>
            <Btn onClick={addNote} disabled={!noteText.trim()}>+</Btn>
          </div>
        </div>
      </div>
    </Modal>}
  </div>
}

// ─── PIPELINE ─────────────────────────────────────────────────────────────────
// ─── PIPELINE ─────────────────────────────────────────────────────────────────
function Pipeline({leads,setLeads,isSuperAdmin}){
  const[selected,setSelected]=useState(null)
  const[filterVariant,setFilterVariant]=useState('all')
  const[filterPerfil,setFilterPerfil]=useState('all')

  const VARIANT_COLORS={'navy':'#4a7cdc','bold':'#c8e000','editorial':'#a8451f','minimalist':'#C9A84C','default':P.muted}
  const PERFIL_COLORS={'retail':P.green,'mam':P.purple,'institucional':P.orange}

  // Obtener valores únicos presentes en los leads
  const variants=[...new Set(leads.map(l=>l.variant).filter(Boolean))].sort()
  const perfiles=[...new Set(leads.map(l=>l.perfil).filter(Boolean))].sort()

  const filtered=leads.filter(l=>{
    if(filterVariant!=='all'&&l.variant!==filterVariant)return false
    if(filterPerfil!=='all'&&l.perfil!==filterPerfil)return false
    return true
  })

  const move=async(id,etapa)=>{
    const u={etapa,advisor_contacted:etapa>=2,account_created:etapa>=3,kyc_verified:etapa>=4,deposit_confirmed:etapa>=5}
    await supabase.from('campaign_leads').update(u).eq('id',id)
    setLeads(p=>p.map(l=>l.id===id?{...l,...u}:l))
    if(selected?.id===id)setSelected(p=>({...p,...u}))
  }

  const FilterBtn=({active,onClick,children,color})=>(
    <button onClick={onClick} style={{fontSize:11,padding:'4px 10px',borderRadius:6,cursor:'pointer',fontWeight:active?700:400,
      background:active?(color+'22'):'rgba(255,255,255,0.04)',
      color:active?(color||P.purple):P.muted,
      border:`1px solid ${active?(color||P.purple)+'55':P.border}`,transition:'all 0.15s'}}>
      {children}
    </button>
  )

  return <div>
    <SHdr title="Pipeline" sub={`${filtered.length} de ${leads.length} leads`}/>

    {/* Filtros */}
    {(variants.length>0||perfiles.length>0)&&<div style={{display:'flex',gap:16,marginBottom:20,flexWrap:'wrap',alignItems:'center',padding:'12px 16px',background:P.surface,borderRadius:10,border:`1px solid ${P.border}`}}>
      {variants.length>0&&<div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
        <span style={{fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600,marginRight:2}}>Landing</span>
        <FilterBtn active={filterVariant==='all'} onClick={()=>setFilterVariant('all')} color={P.purple}>Todas</FilterBtn>
        {variants.map(v=><FilterBtn key={v} active={filterVariant===v} onClick={()=>setFilterVariant(v===filterVariant?'all':v)} color={VARIANT_COLORS[v]||P.muted}>
          {v}
        </FilterBtn>)}
      </div>}
      {perfiles.length>0&&<div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
        <span style={{fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600,marginRight:2}}>Perfil</span>
        <FilterBtn active={filterPerfil==='all'} onClick={()=>setFilterPerfil('all')} color={P.purple}>Todos</FilterBtn>
        {perfiles.map(p=><FilterBtn key={p} active={filterPerfil===p} onClick={()=>setFilterPerfil(p===filterPerfil?'all':p)} color={PERFIL_COLORS[p]||P.muted}>
          {p}
        </FilterBtn>)}
      </div>}
      {(filterVariant!=='all'||filterPerfil!=='all')&&<button onClick={()=>{setFilterVariant('all');setFilterPerfil('all')}} style={{fontSize:11,color:P.muted,background:'none',border:'none',cursor:'pointer',marginLeft:'auto'}}>✕ Limpiar</button>}
    </div>}

    <div style={{display:'flex',gap:14,overflowX:'auto',paddingBottom:12}}>
      {STAGES.map(stage=>{
        const etapa=STAGE_ETAPA[stage]
        const staged=filtered.filter(l=>l.etapa===etapa)
        const color=STAGE_COLOR[stage]
        return <div key={stage} style={{minWidth:200,flex:1}}>
          <div style={{marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:6,height:6,borderRadius:'50%',background:color}}/><span style={{fontSize:11,fontWeight:700,color,textTransform:'uppercase',letterSpacing:'0.06em'}}>{STAGE_LABEL[stage]}</span></div>
            <span style={{fontSize:11,color:P.muted}}>{staged.length}</span>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {staged.map(lead=><GlassCard key={lead.id} style={{padding:14,borderLeft:`3px solid ${color}`,cursor:'pointer'}} onClick={()=>setSelected(lead)}>
              <p style={{fontSize:13,fontWeight:600,color:P.text,margin:'0 0 2px'}}>{lead.full_name}</p>
              <p style={{fontSize:11,color:P.muted,margin:'0 0 8px',fontFamily:'monospace'}}>{lead.email}</p>
              <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:6}}>
                {lead.investment_range&&<Badge label={lead.investment_range} color={P.green}/>}
                {lead.variant&&lead.variant!=='default'&&<Badge label={lead.variant} color={VARIANT_COLORS[lead.variant]||'#888'}/>}
                {lead.perfil&&<Badge label={lead.perfil} color={PERFIL_COLORS[lead.perfil]||P.muted}/>}
              </div>
              <div style={{background:'rgba(255,255,255,0.07)',borderRadius:2,height:3,margin:'4px 0 8px'}}><div style={{background:color,height:3,borderRadius:2,width:`${(etapa/5)*100}%`}}/></div>
              <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                {etapa>1&&<button onClick={e=>{e.stopPropagation();move(lead.id,etapa-1)}} style={{fontSize:10,padding:'3px 7px',borderRadius:4,background:'rgba(255,255,255,0.05)',color:P.muted,border:`1px solid ${P.border}`,cursor:'pointer'}}>← Anterior</button>}
                {etapa<5&&<button onClick={e=>{e.stopPropagation();move(lead.id,etapa+1)}} style={{fontSize:10,padding:'3px 7px',borderRadius:4,background:STAGE_COLOR[STAGES[etapa]]+'18',color:STAGE_COLOR[STAGES[etapa]],border:`1px solid ${STAGE_COLOR[STAGES[etapa]]}30`,cursor:'pointer'}}>→ {STAGE_LABEL[STAGES[etapa]]}</button>}
              </div>
            </GlassCard>)}
            {staged.length===0&&<div style={{border:`1px dashed ${P.border}`,borderRadius:12,padding:'20px 14px',textAlign:'center',fontSize:12,color:P.muted}}>{filtered.length<leads.length?'Sin resultados':'Sin leads'}</div>}
          </div>
        </div>
      })}
    </div>
    {selected&&<Modal title={selected.full_name} onClose={()=>setSelected(null)} accent={STAGE_COLOR[ETAPA_STAGE[selected.etapa]]}>
      <div>
        <div style={{display:'flex',gap:8,marginBottom:18,flexWrap:'wrap'}}>
          <Badge label={STAGE_LABEL[ETAPA_STAGE[selected.etapa]]} color={STAGE_COLOR[ETAPA_STAGE[selected.etapa]]}/>
          {selected.investment_range&&<Badge label={selected.investment_range} color={P.green}/>}
          {selected.team&&<Badge label={selected.team} color={P.blue}/>}
          {selected.variant&&selected.variant!=='default'&&<Badge label={`landing: ${selected.variant}`} color={VARIANT_COLORS[selected.variant]||'#888'}/>}
          {selected.perfil&&<Badge label={`perfil: ${selected.perfil}`} color={PERFIL_COLORS[selected.perfil]||P.muted}/>}
        </div>
        {[['Email',selected.email],['Teléfono',selected.phone||'—'],['Asesor',selected.advisor_assigned||'Sin asignar'],['Score',selected.score||0],['Registro',fmtDate(selected.created_at)]].map(([k,v])=>(
          <div key={k} style={{paddingBottom:10,marginBottom:10,borderBottom:`1px solid ${P.border}`}}>
            <p style={{fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:3,margin:'0 0 3px',fontWeight:600}}>{k}</p>
            <p style={{fontSize:13,color:P.text,margin:0}}>{String(v)}</p>
          </div>
        ))}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:8}}>
          {[['Contactado',selected.advisor_contacted],['Cuenta',selected.account_created],['KYC',selected.kyc_verified],['Depósito',selected.deposit_confirmed]].map(([k,v])=>(
            <div key={k} style={{padding:'8px 12px',borderRadius:8,background:v?P.greenDim:'rgba(255,255,255,0.03)',border:`1px solid ${v?P.green+'30':P.border}`}}>
              <p style={{fontSize:10,color:P.muted,margin:'0 0 2px',textTransform:'uppercase',letterSpacing:'0.06em'}}>{k}</p>
              <p style={{fontSize:13,fontWeight:700,color:v?P.green:P.muted,margin:0}}>{v?'✓ Sí':'—'}</p>
            </div>
          ))}
        </div>
      </div>
    </Modal>}
  </div>
}

// ─── CAMPAÑA MODULE ───────────────────────────────────────────────────────────
function CampanaModule({campaign,user,isSuperAdmin,globalLeads,setGlobalLeads}){
  const[myContacts,setMyContacts]=useState([])
  const[tiers,setTiers]=useState([])
  const[loading,setLoading]=useState(true)
  const[campTab,setCampTab]=useState('general')
  const[showAdd,setShowAdd]=useState(false)
  const[addForm,setAddForm]=useState({crm_contact_id:'',full_name:'',email:'',phone:'',investment_range:'',team:'',perfil:'',variant:'navy'})
  const[addSaving,setAddSaving]=useState(false)
  const[selPart,setSelPart]=useState(null)
  const[filterVariant,setFilterVariant]=useState('all')
  const[filterPerfil,setFilterPerfil]=useState('all')

  // campaign_leads es la fuente única — globalLeads viene del fetch principal
  const leads=globalLeads||[]
  const deposited=leads.filter(l=>l.deposit_confirmed)
  const capital=deposited.reduce((s,l)=>s+(Number(l.deposit_amount_usd)||0),0)
  const myLeads=isSuperAdmin?leads:leads.filter(l=>l.advisor_assigned&&l.advisor_assigned.toLowerCase().includes((user?.email||'').split('@')[0].toLowerCase()))
  const sorted=[...leads].sort((a,b)=>b.score-a.score)
  const variants=[...new Set(leads.map(l=>l.variant).filter(Boolean))].sort()
  const perfiles=[...new Set(leads.map(l=>l.perfil).filter(Boolean))].sort()
  const filtered=myLeads.filter(l=>{
    if(filterVariant!=='all'&&l.variant!==filterVariant)return false
    if(filterPerfil!=='all'&&l.perfil!=='all'&&l.perfil!==filterPerfil)return false
    return true
  })

  const etapaColor={1:P.muted,2:P.blue,3:P.orange,4:P.purple,5:P.green}
  const etapaLabel={1:'Registro',2:'Contactado',3:'Cuenta',4:'KYC',5:'Depósito'}
  const teamColor={radex:'#e74c3c',tradeview:'#3498db'}
  const variantColor={navy:'#4a7cdc',bold:'#c8e000',editorial:'#a8451f',minimalist:'#C9A84C'}
  const perfilColor={retail:P.green,mam:P.purple,asesor:P.orange}

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const[{data:myC},{data:t}]=await Promise.all([
        supabase.from('crm_contacts').select('id,full_name,email,phone').eq('user_id',user.id),
        supabase.from('campaign_bonus_tiers').select('*').order('min_referrals'),
      ])
      setMyContacts(myC||[])
      setTiers(t||[])
    }catch(e){console.error('campaign load:',e)}
    finally{setLoading(false)}
  },[user.id])

  useEffect(()=>{load()},[load])

  // Añadir lead directamente a campaign_leads
  const addLead=async()=>{
    if(!addForm.full_name||!addForm.email)return
    setAddSaving(true)
    // Generar referral_code único
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const code=Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join('')
    const cnt=leads.length
    const payload={
      full_name:addForm.full_name,email:addForm.email,phone:addForm.phone||null,
      investment_range:addForm.investment_range||null,team:addForm.team||null,
      perfil:addForm.perfil||null,variant:addForm.variant||'navy',
      referral_code:code,position_in_queue:cnt+1,
      source:'crm_manual',advisor_assigned:user?.email?.split('@')[0]||null,etapa:1,
    }
    const{data,error}=await supabase.from('campaign_leads').insert(payload).select(
      'id,full_name,email,phone,investment_range,etapa,advisor_assigned,advisor_contacted,account_created,kyc_verified,deposit_confirmed,score,team,created_at,variant,perfil,deposit_amount_usd'
    ).single()
    if(data&&!error){
      setGlobalLeads(p=>[data,...p])
      setShowAdd(false)
      setAddForm({crm_contact_id:'',full_name:'',email:'',phone:'',investment_range:'',team:'',perfil:'',variant:'navy'})
    }
    setAddSaving(false)
  }

  // Actualizar lead en campaign_leads
  const updateLead=async(id,updates)=>{
    await supabase.from('campaign_leads').update({...updates}).eq('id',id)
    setGlobalLeads(p=>p.map(l=>l.id===id?{...l,...updates}:l))
    if(selPart?.id===id)setSelPart(p=>({...p,...updates}))
  }

  const FilterBtn=({active,onClick,children,color})=>(
    <button onClick={onClick} style={{fontSize:11,padding:'4px 10px',borderRadius:6,cursor:'pointer',fontWeight:active?700:400,
      background:active?(color+'22'):'rgba(255,255,255,0.04)',color:active?(color||P.purple):P.muted,
      border:`1px solid ${active?(color||P.purple)+'55':P.border}`,transition:'all 0.15s'}}>
      {children}
    </button>
  )

  return <div>
    <SHdr title={campaign.name} sub={`${leads.length} leads · ${deposited.length} depósitos · ${campaign.status}`}/>

    <div style={{display:'flex',gap:8,marginBottom:20}}>
      {[['general','🏆 General'],['landings','🚀 Landings'],['mis_leads','👤 Mis Leads']].map(([id,label])=>(
        <button key={id} onClick={()=>setCampTab(id)} style={{padding:'7px 14px',borderRadius:8,fontSize:13,cursor:'pointer',
          background:campTab===id?P.purpleDim:'rgba(255,255,255,0.04)',
          color:campTab===id?P.purple:P.muted,
          border:`1px solid ${campTab===id?P.purpleBorder:P.border}`,fontWeight:campTab===id?600:400}}>{label}</button>
      ))}
      {campTab==='mis_leads'&&<Btn onClick={()=>setShowAdd(true)} style={{marginLeft:'auto'}}>+ Añadir lead</Btn>}
    </div>

    {campTab==='general'&&(loading?<Spinner/>:<div>
      <div style={{display:'flex',gap:14,marginBottom:22,flexWrap:'wrap'}}>
        <StatCard label="Capital levantado" value={capital>0?`$${(capital/1000).toFixed(0)}k`:'$0'} sub={`${deposited.length} depósitos`} accent={P.green} Icon="💵"/>
        <StatCard label="Cupos" value={`${deposited.length}/${campaign.total_spots||50}`} sub={`${(campaign.total_spots||50)-deposited.length} libres`} accent={P.purple} Icon="🎯"/>
        <StatCard label="Leads totales" value={leads.length} accent={P.blue} Icon="👥"/>
        <StatCard label="Estado" value={campaign.status[0].toUpperCase()+campaign.status.slice(1)} accent={campaign.status==='activa'?P.green:P.orange} Icon="📡"/>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18}}>
        <GlassCard style={{padding:0}}>
          <div style={{padding:'14px 18px',borderBottom:`1px solid ${P.border}`}}>
            <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',margin:0}}>🏆 Leaderboard</p>
          </div>
          {sorted.length===0&&<p style={{padding:20,color:P.muted,fontSize:13,margin:0}}>Sin leads</p>}
          {sorted.map((lead,i)=>(
            <div key={lead.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 18px',borderBottom:`1px solid ${P.border}`}}>
              <div style={{width:26,height:26,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',
                background:i===0?'rgba(255,215,0,0.2)':i===1?'rgba(192,192,192,0.15)':i===2?'rgba(205,127,50,0.15)':P.purpleDim,
                fontSize:12,fontWeight:800,color:i===0?'#ffd700':i===1?'#c0c0c0':i===2?'#cd7f32':P.purple,flexShrink:0}}>{i+1}</div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:13,fontWeight:600,color:P.text,margin:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{lead.full_name}</p>
                <div style={{display:'flex',gap:4,marginTop:3,flexWrap:'wrap'}}>
                  <Badge label={etapaLabel[lead.etapa]||'—'} color={etapaColor[lead.etapa]||P.muted}/>
                  {lead.variant&&<Badge label={lead.variant} color={variantColor[lead.variant]||P.muted}/>}
                  {lead.team&&<Badge label={lead.team} color={teamColor[lead.team]||P.muted}/>}
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:4,background:P.purpleDim,border:`1px solid ${P.purpleBorder}`,borderRadius:8,padding:'4px 10px',flexShrink:0}}>
                <span style={{fontSize:14,fontWeight:800,color:P.purple,fontFamily:'monospace'}}>{lead.score||0}</span>
                <span style={{fontSize:10,color:P.muted}}>pts</span>
              </div>
            </div>
          ))}
        </GlassCard>

        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          {tiers.length>0&&<GlassCard>
            <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:14,margin:'0 0 14px'}}>Bonus tiers</p>
            {tiers.map(t=>(
              <div key={t.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',marginBottom:8,borderRadius:8,background:P.purpleDim,border:`1px solid ${P.purpleBorder}`}}>
                <span style={{fontSize:13,color:P.textSub}}>{t.min_referrals}+ referidos</span>
                <div style={{background:P.greenDim,border:`1px solid ${P.green}30`,borderRadius:6,padding:'2px 8px'}}>
                  <span style={{fontSize:13,fontWeight:700,color:P.green}}>+{t.bonus_percentage}%</span>
                </div>
              </div>
            ))}
          </GlassCard>}
          <GlassCard>
            <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:14,margin:'0 0 14px'}}>Leads por capital</p>
            {['1k-5k','5k-20k','20k-50k','50k+'].map(r=>{
              const cnt=leads.filter(l=>l.investment_range===r).length
              const dep=leads.filter(l=>l.investment_range===r&&l.deposit_confirmed).length
return <div key={r} style={{marginBottom:12}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                  <span style={{fontSize:12,color:P.textSub}}>{r}</span>
                  <span style={{fontSize:12,color:P.muted}}>{dep}/{cnt}</span>
                </div>
                <div style={{background:'rgba(255,255,255,0.06)',borderRadius:3,height:4}}>
                  <div style={{background:P.green,height:4,borderRadius:3,width:`${leads.length?cnt/leads.length*100:0}%`}}/>
                </div>
              </div>
            })}
          </GlassCard>
        </div>
      </div>
    </div>)}


    {campTab==='landings'&&<div>
      <p style={{fontSize:12,color:P.muted,marginBottom:20}}>Variantes de landing page activas para esta campaña. Haz clic para abrir en nueva pestaña.</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:16,marginBottom:28}}>
        {[
          {id:'navy',     label:'Navy',     desc:'Fondo azul marino · tipografía Syne · estilo profesional', color:'#4a7cdc', url:'/campana/navy'},
          {id:'editorial',label:'Editorial',desc:'Fondo crema · Instrument Serif · estilo editorial', color:'#a8451f', url:'/campana/editorial'},
          {id:'bold',     label:'Bold',     desc:'Fondo negro · Space Grotesk · estilo tecnológico', color:'#c8e000', url:'/campana/bold'},
          {id:'minimalist',label:'Minimalist',desc:'Fondo negro elegante · Cormorant · ticker LATAM · OTP WA+email · enfoque LATAM', color:'#C9A84C', url:'/campana/minimalist'},
        ].map(v=>{
          const cnt=leads.filter(l=>l.variant===v.id).length
          const dep=leads.filter(l=>l.variant===v.id&&l.deposit_confirmed).length
          const top=leads.filter(l=>l.variant===v.id).sort((a,b)=>b.score-a.score).slice(0,1)[0]
          return <GlassCard key={v.id} style={{borderLeft:`3px solid ${v.color}`,padding:20}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:v.color,letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:4}}>{v.label}</div>
                <div style={{fontSize:12,color:P.muted,lineHeight:1.5}}>{v.desc}</div>
              </div>
              <div style={{background:v.color+'18',border:`1px solid ${v.color}40`,borderRadius:8,padding:'4px 10px',textAlign:'center',flexShrink:0,marginLeft:10}}>
                <div style={{fontSize:18,fontWeight:800,color:v.color}}>{cnt}</div>
                <div style={{fontSize:9,color:P.muted,textTransform:'uppercase',letterSpacing:'0.08em'}}>leads</div>
              </div>
            </div>
            <div style={{display:'flex',gap:10,marginBottom:14}}>
              <div style={{flex:1,background:'rgba(255,255,255,0.04)',borderRadius:8,padding:'8px 12px',textAlign:'center'}}>
                <div style={{fontSize:15,fontWeight:700,color:P.green}}>{dep}</div>
                <div style={{fontSize:9,color:P.muted,textTransform:'uppercase',letterSpacing:'0.06em'}}>depósitos</div>
              </div>
              <div style={{flex:1,background:'rgba(255,255,255,0.04)',borderRadius:8,padding:'8px 12px',textAlign:'center'}}>
                <div style={{fontSize:15,fontWeight:700,color:P.purple}}>{cnt>0?Math.round(dep/cnt*100):0}%</div>
                <div style={{fontSize:9,color:P.muted,textTransform:'uppercase',letterSpacing:'0.06em'}}>conversión</div>
              </div>
            </div>
            {top&&<div style={{fontSize:11,color:P.muted,marginBottom:12,padding:'6px 10px',background:'rgba(255,255,255,0.03)',borderRadius:6}}>
              🏆 Top: <span style={{color:P.text,fontWeight:600}}>{top.full_name}</span> · {top.score} pts
            </div>}
            <div style={{display:'flex',gap:8}}>
              <a href={`https://pessaro.cl${v.url}`} target="_blank" rel="noopener noreferrer"
                style={{flex:1,padding:'9px 0',background:v.color,color:'#000',border:'none',borderRadius:8,
                  fontSize:12,fontWeight:700,cursor:'pointer',textAlign:'center',textDecoration:'none',display:'block'}}>
                Ver landing →
              </a>
              <a href={`https://pessaro.cl${v.url}?ref=DEMO`} target="_blank" rel="noopener noreferrer"
                style={{padding:'9px 12px',background:'rgba(255,255,255,0.05)',color:P.muted,border:`1px solid ${P.border}`,
                  borderRadius:8,fontSize:12,cursor:'pointer',textDecoration:'none',display:'block'}}>
                + Ref
              </a>
            </div>
          </GlassCard>
        })}
      </div>

      {/* Links de referido por variante */}
      <GlassCard>
        <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:14,margin:'0 0 14px'}}>Links de referido por variante</p>
        {['navy','editorial','bold','minimalist'].map(v=>(
          <div key={v} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:`1px solid ${P.border}`}}>
            <span style={{fontSize:12,fontWeight:600,color:P.text,minWidth:70,textTransform:'capitalize'}}>{v}</span>
            <code style={{flex:1,fontSize:11,color:P.muted,background:'rgba(255,255,255,0.04)',padding:'5px 10px',borderRadius:6,fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {`https://pessaro.cl/campana/${v}?ref=CODIGO`}
            </code>
            <button onClick={()=>navigator.clipboard.writeText(`https://pessaro.cl/campana/${v}?ref=CODIGO`)}
              style={{padding:'5px 10px',background:'rgba(255,255,255,0.06)',color:P.muted,border:`1px solid ${P.border}`,borderRadius:6,fontSize:11,cursor:'pointer'}}>
              Copiar
            </button>
          </div>
        ))}
      </GlassCard>
    </div>}

    {campTab==='mis_leads'&&(loading?<Spinner/>:<div>
      <GlassCard style={{padding:0,marginBottom:16}}>
        <div style={{padding:'12px 18px',borderBottom:`1px solid ${P.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <p style={{fontSize:12,fontWeight:600,color:P.textSub,margin:0}}>{isSuperAdmin?'Todos los leads':'Mis leads'} · {filtered.length}</p>
        </div>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr style={{borderBottom:`1px solid ${P.border}`}}>
            {['Nombre','Email','Capital','Equipo','Contactado','Cuenta','KYC','Depósito'].map(h=>(
              <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.map((p,i)=>(

              <tr key={p.id} style={{borderBottom:i<filtered.length-1?`1px solid ${P.border}`:'none',cursor:'pointer'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.025)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                onClick={()=>setSelPart(p)}>
                <td style={{padding:'11px 14px',fontSize:13,fontWeight:600,color:P.text}}>{p.full_name}</td>
                <td style={{padding:'11px 14px',fontSize:12,color:P.muted,fontFamily:'monospace'}}>{p.email}</td>
                <td style={{padding:'11px 14px'}}>{p.investment_range?<Badge label={p.investment_range} color={P.green}/>:'—'}</td>
                <td style={{padding:'11px 14px'}}>{p.team?<Badge label={p.team} color={teamColor[p.team]||P.muted}/>:'—'}</td>
                {[['advisor_contacted',p.advisor_contacted],['account_created',p.account_created],['kyc_verified',p.kyc_verified],['deposit_confirmed',p.deposit_confirmed]].map(([field,val])=>(
                  <td key={field} style={{padding:'11px 14px'}}>
                    <button onClick={e=>{e.stopPropagation();updatePart(p.id,{[field]:!val})}}
                      style={{padding:'3px 8px',borderRadius:5,fontSize:11,cursor:'pointer',fontWeight:600,
                        background:val?P.greenDim:'rgba(255,255,255,0.04)',color:val?P.green:P.muted,
                        border:`1px solid ${val?P.green+'30':P.border}`}}>{val?'✓ Sí':'— No'}</button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length===0&&<div style={{textAlign:'center',padding:32,color:P.muted,fontSize:13}}>Sin leads. Añade uno con el botón "+ Añadir lead".</div>}
      </GlassCard>
    </div>)}

    {showAdd&&<Modal title="Añadir lead a campaña" onClose={()=>setShowAdd(false)} accent={P.purple}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div><Lbl>Desde mis contactos</Lbl>
          <Sel value={addForm.crm_contact_id} onChange={v=>{
            const c=myContacts.find(x=>x.id===v)
            if(c)setAddForm(p=>({...p,crm_contact_id:v,full_name:c.full_name,email:c.email,phone:c.phone||''}))
            else setAddForm(p=>({...p,crm_contact_id:v}))
          }} options={[{value:'',label:'Ingresar manualmente'},...myContacts.map(c=>({value:c.id,label:`${c.full_name} · ${c.email}`}))]}/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><Lbl>Nombre *</Lbl><Input value={addForm.full_name} onChange={v=>setAddForm(p=>({...p,full_name:v}))} placeholder="Nombre completo"/></div>
          <div><Lbl>Email *</Lbl><Input value={addForm.email} onChange={v=>setAddForm(p=>({...p,email:v}))} placeholder="email@ejemplo.com"/></div>
          <div><Lbl>Teléfono</Lbl><Input value={addForm.phone} onChange={v=>setAddForm(p=>({...p,phone:v}))} placeholder="+56 9..."/></div>
          <div><Lbl>Capital</Lbl><Sel value={addForm.investment_range} onChange={v=>setAddForm(p=>({...p,investment_range:v}))} options={[{value:'',label:'Seleccionar'},{value:'1k-5k',label:'1k-5k'},{value:'5k-20k',label:'5k-20k'},{value:'20k-50k',label:'20k-50k'},{value:'50k+',label:'50k+'}]}/></div>
          <div><Lbl>Equipo</Lbl><Sel value={addForm.team} onChange={v=>setAddForm(p=>({...p,team:v}))} options={[{value:'',label:'Sin equipo'},{value:'radex',label:'Radex'},{value:'tradeview',label:'Tradeview'}]}/></div>
          <div><Lbl>Landing</Lbl><Sel value={addForm.variant} onChange={v=>setAddForm(p=>({...p,variant:v}))} options={[{value:'navy',label:'Navy'},{value:'editorial',label:'Editorial'},{value:'bold',label:'Bold'},{value:'minimalist',label:'Minimalist'}]}/></div>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',paddingTop:8}}>
          <Btn variant="ghost" onClick={()=>setShowAdd(false)}>Cancelar</Btn>
          <Btn onClick={addParticipant} disabled={addSaving||!addForm.full_name||!addForm.email}>{addSaving?'Guardando...':'Añadir'}</Btn>
        </div>
      </div>
    </Modal>}

    {selPart&&<Modal title={selPart.full_name} onClose={()=>setSelPart(null)}>
      <div>
        <div style={{display:'flex',gap:8,marginBottom:18,flexWrap:'wrap'}}>
          <Badge label={etapaLabel[selPart.etapa]||selPart.etapa} color={etapaColor[selPart.etapa]||P.muted}/>
          {selPart.team&&<Badge label={selPart.team} color={teamColor[selPart.team]||P.muted}/>}
          {selPart.investment_range&&<Badge label={selPart.investment_range} color={P.green}/>}
        </div>
        {[['Email',selPart.email],['Teléfono',selPart.phone||'—'],['Depósito USD',selPart.deposit_amount_usd?`$${Number(selPart.deposit_amount_usd).toLocaleString()}`:'—'],['Registro',fmtDate(selPart.created_at)]].map(([k,v])=>(
          <div key={k} style={{paddingBottom:10,marginBottom:10,borderBottom:`1px solid ${P.border}`}}>
            <p style={{fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:3,margin:'0 0 3px',fontWeight:600}}>{k}</p>
            <p style={{fontSize:13,color:P.text,margin:0}}>{v}</p>
          </div>
        ))}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:8}}>
          {[['Contactado','advisor_contacted',selPart.advisor_contacted],['Cuenta','account_created',selPart.account_created],['KYC','kyc_verified',selPart.kyc_verified],['Depósito','deposit_confirmed',selPart.deposit_confirmed]].map(([k,field,v])=>(
            <button key={k} onClick={()=>updatePart(selPart.id,{[field]:!v})}
              style={{padding:'10px 12px',borderRadius:8,cursor:'pointer',textAlign:'left',background:v?P.greenDim:'rgba(255,255,255,0.03)',border:`1px solid ${v?P.green+'30':P.border}`}}>
              <p style={{fontSize:10,color:P.muted,margin:'0 0 4px',textTransform:'uppercase',letterSpacing:'0.06em'}}>{k}</p>
              <p style={{fontSize:13,fontWeight:700,color:v?P.green:P.muted,margin:0}}>{v?'✓ Sí':'— No'}</p>
            </button>
          ))}
        </div>
      </div>
    </Modal>}
  </div>
}


// ─── ADMIN CAMPAÑAS ───────────────────────────────────────────────────────────
function AdminCampaigns({campaigns,setCampaigns,user}){
  const[showNew,setShowNew]=useState(false)
  const[saving,setSaving]=useState(false)
  const[form,setForm]=useState({name:'',slug:'',description:'',total_spots:50,broker:'',historical_return:'+502%',target_capital:'',start_date:'',status:'activa'})
  const[err,setErr]=useState({})
  const STATUS_C={activa:P.green,pausada:P.orange,cerrada:P.muted}

  const validate=()=>{
    const e={}
    if(!form.name.trim())e.name='Obligatorio'
    if(!form.slug.trim())e.slug='Obligatorio'
    else if(!/^[a-z0-9-]+$/.test(form.slug))e.slug='Solo minúsculas, números y guiones'
    setErr(e); return !Object.keys(e).length
  }

  const create=async()=>{
    if(!validate())return
    setSaving(true)
    const{data,error}=await supabase.from('campaigns').insert({...form,total_spots:Number(form.total_spots)||50,created_by:user.id}).select().single()
    setSaving(false)
    if(error){setErr({slug:error.message});return}
    setCampaigns(p=>[...p,data])
    setShowNew(false)
    setForm({name:'',slug:'',description:'',total_spots:50,broker:'',historical_return:'+502%',target_capital:'',start_date:'',status:'activa'})
    setErr({})
  }

  const updateStatus=async(id,status)=>{
    await supabase.from('campaigns').update({status}).eq('id',id)
    setCampaigns(p=>p.map(c=>c.id===id?{...c,status}:c))
  }

  return <div>
    <SHdr title="Gestionar Campañas" sub="Crea y administra campañas · solo super admin"
      action={<Btn onClick={()=>setShowNew(true)}>+ Nueva campaña</Btn>}/>
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      {campaigns.map(c=>(
        <GlassCard key={c.id} style={{borderLeft:`3px solid ${STATUS_C[c.status]}`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                <Badge label={c.status} color={STATUS_C[c.status]}/>
                <span style={{fontSize:11,color:P.muted,fontFamily:'monospace'}}>{c.slug}</span>
              </div>
              <h3 style={{margin:'0 0 4px',fontSize:16,fontWeight:700,color:P.text}}>{c.name}</h3>
              {c.description&&<p style={{margin:'0 0 10px',fontSize:13,color:P.muted}}>{c.description}</p>}
              <div style={{display:'flex',gap:14,flexWrap:'wrap'}}>
                {[['Cupos',c.total_spots],['Broker',c.broker||'—'],['Retorno',c.historical_return||'—'],['Capital obj.',c.target_capital||'—']].map(([k,v])=>(
                  <span key={k} style={{fontSize:11,color:P.muted}}><strong style={{color:P.textSub}}>{k}:</strong> {v}</span>
                ))}
              </div>
            </div>
            <div style={{display:'flex',gap:6}}>
              {['activa','pausada','cerrada'].map(s=>(
                <button key={s} onClick={()=>updateStatus(c.id,s)} disabled={c.status===s}
                  style={{padding:'5px 12px',borderRadius:6,fontSize:11,cursor:c.status===s?'default':'pointer',
                    background:c.status===s?STATUS_C[s]+'25':'rgba(255,255,255,0.04)',
                    color:c.status===s?STATUS_C[s]:P.muted,
                    border:`1px solid ${c.status===s?STATUS_C[s]+'40':P.border}`,fontWeight:600}}>
                  {s[0].toUpperCase()+s.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div style={{marginTop:12,padding:'8px 12px',background:'rgba(255,255,255,0.03)',borderRadius:8,border:`1px solid ${P.border}`}}>
            <p style={{fontSize:11,color:P.muted,margin:0}}>
              Los asesores ven <strong style={{color:P.text}}>🚀 {c.name}</strong> en su sidebar {c.status==='activa'?'✓':'· pausada/cerrada = oculta para asesores'}.
            </p>
          </div>
        </GlassCard>
      ))}
      {campaigns.length===0&&<GlassCard><p style={{color:P.muted,fontSize:14,textAlign:'center',padding:'20px 0',margin:0}}>No hay campañas. Crea la primera.</p></GlassCard>}
    </div>

    {showNew&&<Modal title="Nueva campaña" onClose={()=>setShowNew(false)} accent={P.green}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><Lbl>Nombre *</Lbl>
            <Input value={form.name} onChange={v=>setForm(p=>({...p,name:v,slug:v.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')}))} placeholder="Campaña Q3 2026"/>
            {err.name&&<p style={{fontSize:11,color:P.red,margin:'3px 0 0'}}>{err.name}</p>}
          </div>
          <div><Lbl>Slug *</Lbl>
            <Input value={form.slug} onChange={v=>setForm(p=>({...p,slug:v}))} placeholder="q3-2026"/>
            {err.slug&&<p style={{fontSize:11,color:P.red,margin:'3px 0 0'}}>{err.slug}</p>}
          </div>
          <div><Lbl>Broker</Lbl><Input value={form.broker} onChange={v=>setForm(p=>({...p,broker:v}))} placeholder="Radex / Tradeview"/></div>
          <div><Lbl>Cupos</Lbl><Input value={form.total_spots} onChange={v=>setForm(p=>({...p,total_spots:v}))} type="number" placeholder="50"/></div>
          <div><Lbl>Retorno histórico</Lbl><Input value={form.historical_return} onChange={v=>setForm(p=>({...p,historical_return:v}))} placeholder="+502%"/></div>
          <div><Lbl>Capital objetivo</Lbl><Input value={form.target_capital} onChange={v=>setForm(p=>({...p,target_capital:v}))} placeholder="$500,000 USD"/></div>
          <div><Lbl>Fecha inicio</Lbl><Input value={form.start_date} onChange={v=>setForm(p=>({...p,start_date:v}))} type="date"/></div>
          <div><Lbl>Estado</Lbl><Sel value={form.status} onChange={v=>setForm(p=>({...p,status:v}))} options={[{value:'activa',label:'Activa'},{value:'pausada',label:'Pausada'}]}/></div>
        </div>
        <div><Lbl>Descripción</Lbl>
          <textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} placeholder="Descripción..."
            style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8,padding:10,color:P.text,fontSize:13,outline:'none',width:'100%',minHeight:60,resize:'vertical',fontFamily:'inherit'}}/>
        </div>
        <div style={{padding:'8px 12px',background:P.greenDim,border:`1px solid ${P.green}30`,borderRadius:8}}>
          <p style={{fontSize:12,color:P.green,margin:0}}>✓ Aparecerá automáticamente en el sidebar de todos los asesores.</p>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <Btn variant="ghost" onClick={()=>setShowNew(false)}>Cancelar</Btn>
          <Btn onClick={create} disabled={saving}>{saving?'Creando...':'Crear campaña'}</Btn>
        </div>
      </div>
    </Modal>}
  </div>
}

// ─── TASKS ────────────────────────────────────────────────────────────────────
function Tasks({contacts,leads}){
  const[tasks,setTasks]=useState([])
  const[loading,setLoading]=useState(true)
  const[showAdd,setShowAdd]=useState(false)
  const[form,setForm]=useState({title:'',priority:'media',due_date:'',contact_submission_id:'',campaign_lead_id:''})
  const load=useCallback(async()=>{
    setLoading(true)
    try{const{data}=await supabase.from('crm_tasks').select('*').order('created_at',{ascending:false});setTasks(data||[])}
    catch(e){console.error(e)}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{load()},[load])
  const addTask=async()=>{
    if(!form.title)return
    const p={...form,done:false}
    if(!p.contact_submission_id)delete p.contact_submission_id
    if(!p.campaign_lead_id)delete p.campaign_lead_id
    const{data}=await supabase.from('crm_tasks').insert(p).select().single()
    if(data){setTasks(p=>[data,...p]);setShowAdd(false);setForm({title:'',priority:'media',due_date:'',contact_submission_id:'',campaign_lead_id:''})}
  }
  const toggle=async(id,done)=>{await supabase.from('crm_tasks').update({done:!done}).eq('id',id);setTasks(p=>p.map(t=>t.id===id?{...t,done:!done}:t))}
  const del=async id=>{await supabase.from('crm_tasks').delete().eq('id',id);setTasks(p=>p.filter(t=>t.id!==id))}
  const getName=t=>{
    if(t.contact_submission_id)return contacts.find(c=>c.id===t.contact_submission_id)?.full_name||''
    if(t.campaign_lead_id)return leads.find(l=>l.id===t.campaign_lead_id)?.full_name||''
    return''
  }
  const pending=tasks.filter(t=>!t.done), done=tasks.filter(t=>t.done)
  return <div>
    <SHdr title="Tareas" sub={`${pending.length} pendientes · ${done.length} completadas`} action={<Btn onClick={()=>setShowAdd(true)}>+ Nueva tarea</Btn>}/>
    {loading?<Spinner/>:<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
      <div>
        <p style={{fontSize:10,fontWeight:700,color:P.orange,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:14,margin:'0 0 14px'}}>● Pendientes ({pending.length})</p>
        {pending.map(t=><GlassCard key={t.id} style={{marginBottom:10,display:'flex',gap:12,alignItems:'flex-start',borderLeft:`3px solid ${PRIO_COLOR[t.priority]}`}}>
          <button onClick={()=>toggle(t.id,t.done)} style={{width:20,height:20,borderRadius:6,border:`2px solid ${PRIO_COLOR[t.priority]}`,background:'transparent',cursor:'pointer',flexShrink:0,marginTop:2}}/>
          <div style={{flex:1}}>
            <p style={{fontSize:14,fontWeight:500,color:P.text,margin:'0 0 6px'}}>{t.title}</p>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
              {getName(t)&&<span style={{fontSize:11,color:P.muted}}>{getName(t)}</span>}
              <Badge label={t.priority} color={PRIO_COLOR[t.priority]}/>
              {t.due_date&&<span style={{fontSize:11,color:P.muted}}>{fmtDate(t.due_date)}</span>}
            </div>
          </div>
          <button onClick={()=>del(t.id)} style={{background:'none',border:'none',color:P.muted,cursor:'pointer',fontSize:14}}>✕</button>
        </GlassCard>)}
        {pending.length===0&&<div style={{display:'flex',alignItems:'center',gap:8,padding:'20px 0'}}><div style={{width:8,height:8,borderRadius:'50%',background:P.green}}/><span style={{color:P.green,fontSize:13,fontWeight:500}}>¡Todo al día!</span></div>}
      </div>
      <div>
        <p style={{fontSize:10,fontWeight:700,color:P.green,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:14,margin:'0 0 14px'}}>● Completadas ({done.length})</p>
        {done.map(t=><GlassCard key={t.id} style={{marginBottom:10,opacity:0.4}}>
          <div style={{display:'flex',gap:10,alignItems:'center'}}><div style={{width:20,height:20,borderRadius:6,background:P.green,display:'flex',alignItems:'center',justifyContent:'center',color:'#000',fontSize:10,fontWeight:700}}>✓</div><span style={{fontSize:14,textDecoration:'line-through',color:P.muted}}>{t.title}</span></div>
        </GlassCard>)}
      </div>
    </div>}
    {showAdd&&<Modal title="Nueva tarea" onClose={()=>setShowAdd(false)} accent={P.orange}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div><Lbl>Título *</Lbl><Input value={form.title} onChange={v=>setForm(p=>({...p,title:v}))} placeholder="Descripción de la tarea"/></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><Lbl>Prioridad</Lbl><Sel value={form.priority} onChange={v=>setForm(p=>({...p,priority:v}))} options={[{value:'alta',label:'Alta'},{value:'media',label:'Media'},{value:'baja',label:'Baja'}]}/></div>
          <div><Lbl>Fecha</Lbl><Input value={form.due_date} onChange={v=>setForm(p=>({...p,due_date:v}))} type="date"/></div>
        </div>
        <div><Lbl>Contacto</Lbl><Sel value={form.contact_submission_id} onChange={v=>setForm(p=>({...p,contact_submission_id:v}))} options={[{value:'',label:'Sin contacto'},...contacts.map(c=>({value:c.id,label:c.full_name||c.email}))]}/></div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',paddingTop:8}}>
          <Btn variant="ghost" onClick={()=>setShowAdd(false)}>Cancelar</Btn>
          <Btn onClick={addTask} disabled={!form.title}>Guardar</Btn>
        </div>
      </div>
    </Modal>}
  </div>
}

// ─── EMAILS ───────────────────────────────────────────────────────────────────
function Emails({contacts,leads,staffProfile,user,isSuperAdmin}){
  const[emails,setEmails]=useState([])
  const[loading,setLoading]=useState(true)
  const[tab,setTab]=useState('historial')
  const[showModal,setShowModal]=useState(false)
  const[sending,setSending]=useState(false)
  const[sent,setSent]=useState(null)
  const[form,setForm]=useState({template:'bienvenida_lead',source_id:'',extra_text:'',custom_subject:'',teams_url:''})
  const[recipientSearch,setRecipientSearch]=useState('')
  const[recipientOpen,setRecipientOpen]=useState(false)
  const[files,setFiles]=useState([])
  const[dragOver,setDragOver]=useState(false)

  const loadHistory=useCallback(async()=>{
    setLoading(true)
    try{const{data}=await supabase.from('email_tracking').select('*').order('sent_at',{ascending:false}).limit(60);setEmails(data||[])}
    catch(e){console.error(e)}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{loadHistory()},[loadHistory])

  const sc={sent:P.blue,delivered:P.blue,opened:P.green,clicked:P.green,bounced:P.red,complained:P.red,delayed:P.orange}
  const allRecipients=[
    ...contacts.map(c=>({id:c.id,name:c.full_name,email:c.email,type:'contact'})),
    ...leads.filter(l=>!contacts.find(c=>c.email===l.email)).map(l=>({id:l.id,name:l.full_name,email:l.email,type:'lead'}))
  ].filter(r=>r.email)
  const selectedRecipient=allRecipients.find(r=>r.id===form.source_id)
  const selectedTpl=TEMPLATES.find(t=>t.id===form.template)||TEMPLATES[0]
  const needsSubject=form.template==='personalizado'
  const canSend=!!selectedRecipient&&!!form.template&&(!needsSubject||form.custom_subject)&&(form.template!=='personalizado'||form.extra_text)

  const handleFiles=async fileList=>{
    const arr=[]
    for(const f of fileList){
      if(f.size>5*1024*1024){alert(`${f.name} supera 5MB`);continue}
      const b64=await new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result.split(',')[1]);r.readAsDataURL(f)})
      arr.push({filename:f.name,content:b64,size:f.size})
    }
    setFiles(p=>[...p,...arr])
  }

  const send=async()=>{
    if(!canSend)return
    setSending(true);setSent(null)
    try{
      const{data:{session}}=await supabase.auth.getSession()
      const res=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm_send_email`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
        body:JSON.stringify({to:selectedRecipient.email,name:selectedRecipient.name,template_id:form.template,custom_subject:form.custom_subject,extra_text:form.extra_text,teams_url:form.teams_url,attachments:files.map(f=>({filename:f.filename,content:f.content}))})
      })
      const data=await res.json()
      if(data.ok){setSent({ok:true,msg:`✓ Enviado a ${selectedRecipient.email} · desde ${staffProfile?.pessaro_email||'info@pessaro.cl'}`});setForm({template:'bienvenida_lead',source_id:'',extra_text:'',custom_subject:'',teams_url:''});setRecipientSearch('');setRecipientOpen(false);setFiles([]);loadHistory()}
      else setSent({ok:false,msg:data.error||'Error al enviar'})
    }catch(e){setSent({ok:false,msg:e.message})}
    setSending(false)
  }

  const openModal=(tplId)=>{setSent(null);if(tplId)setForm(p=>({...p,template:tplId}));setShowModal(true)}

  return <div>
    <SHdr title="Emails" sub={`${emails.length} enviados · ${staffProfile?.pessaro_email||'info@pessaro.cl'}`}
      action={<Btn variant="blue" onClick={()=>openModal()}>✉ Redactar</Btn>}/>
    <div style={{display:'flex',gap:8,marginBottom:20}}>
      {[['historial','📋 Historial'],['plantillas','🗂 Plantillas']].map(([id,label])=>(
        <button key={id} onClick={()=>setTab(id)} style={{padding:'7px 14px',borderRadius:8,fontSize:13,cursor:'pointer',background:tab===id?P.purpleDim:'rgba(255,255,255,0.04)',color:tab===id?P.purple:P.muted,border:`1px solid ${tab===id?P.purpleBorder:P.border}`,fontWeight:tab===id?600:400}}>{label}</button>
      ))}
    </div>
    {tab==='historial'&&(loading?<Spinner/>:<GlassCard style={{padding:0}}>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead><tr style={{borderBottom:`1px solid ${P.border}`}}>
          {['Destinatario','Plantilla','Estado','Enviado','Abierto'].map(h=><th key={h} style={{padding:'12px 18px',textAlign:'left',fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',fontWeight:600}}>{h}</th>)}
        </tr></thead>
        <tbody>
          {emails.map((e,i)=><tr key={e.id} style={{borderBottom:i<emails.length-1?`1px solid ${P.border}`:'none'}}>
            <td style={{padding:'12px 18px'}}><p style={{fontSize:13,fontWeight:600,color:P.text,margin:0}}>{e.recipient_name||e.recipient_email}</p><p style={{fontSize:11,color:P.muted,margin:0,fontFamily:'monospace'}}>{e.recipient_email}</p></td>
            <td style={{padding:'12px 18px'}}><Badge label={e.email_type||'—'} color={TEMPLATES.find(t=>t.id===e.email_type)?.color||P.muted}/></td>
            <td style={{padding:'12px 18px'}}><Badge label={e.status} color={sc[e.status]||P.muted}/></td>
            <td style={{padding:'12px 18px',color:P.muted,fontSize:12}}>{fmtDate(e.sent_at)}</td>
            <td style={{padding:'12px 18px',color:e.opened_at?P.green:P.muted,fontSize:12}}>{e.opened_at?fmtDate(e.opened_at):'—'}</td>
          </tr>)}
        </tbody>
      </table>
      {emails.length===0&&<div style={{textAlign:'center',padding:48,color:P.muted,fontSize:13}}>Sin emails enviados</div>}
    </GlassCard>)}
    {tab==='plantillas'&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:14}}>
      {TEMPLATES.filter(t=>t.id!=='accesos_crm'||isSuperAdmin).map(t=><GlassCard key={t.id} style={{borderLeft:`3px solid ${t.color}`}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}><div style={{width:8,height:8,borderRadius:'50%',background:t.color}}/><span style={{fontSize:14,fontWeight:600,color:P.text}}>{t.label}</span></div>
        <p style={{fontSize:12,color:P.muted,margin:'0 0 12px'}}>{t.desc}</p>
        <button onClick={()=>openModal(t.id)} style={{width:'100%',padding:'7px',borderRadius:6,fontSize:12,cursor:'pointer',background:t.color+'18',color:t.color,border:`1px solid ${t.color}30`,fontWeight:600}}>Usar plantilla →</button>
      </GlassCard>)}
    </div>}

    {showModal&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20}}>
      <div style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:16,width:'100%',maxWidth:620,maxHeight:'92vh',overflow:'auto',boxShadow:'0 25px 60px rgba(0,0,0,0.6)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'18px 24px',borderBottom:`1px solid ${P.border}`}}>
          <div><div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:8,height:8,borderRadius:'50%',background:selectedTpl.color}}/><h3 style={{margin:0,fontSize:16,fontWeight:700,color:P.text}}>Redactar email</h3></div>
            {staffProfile&&<p style={{margin:'2px 0 0',fontSize:11,color:P.purple}}>Enviando como: <strong>{staffProfile.pessaro_email}</strong></p>}
          </div>
          <button onClick={()=>{setShowModal(false);setRecipientSearch('');setRecipientOpen(false)}} style={{background:'none',border:'none',color:P.muted,cursor:'pointer',fontSize:20}}>✕</button>
        </div>
        <div style={{padding:24,display:'flex',flexDirection:'column',gap:16}}>
          <div>
            <Lbl>Plantilla</Lbl>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {TEMPLATES.filter(t=>t.id!=='accesos_crm'||isSuperAdmin).map(t=><button key={t.id} onClick={()=>setForm(p=>({...p,template:t.id}))}
                style={{padding:'5px 12px',borderRadius:6,fontSize:11,cursor:'pointer',fontWeight:600,background:form.template===t.id?t.color+'25':'rgba(255,255,255,0.04)',color:form.template===t.id?t.color:P.muted,border:`1px solid ${form.template===t.id?t.color+'60':P.border}`}}>{t.label}</button>)}
            </div>
          </div>
          <div style={{position:'relative'}}>
            <Lbl>Destinatario *</Lbl>
            <input value={recipientSearch} onChange={e=>{setRecipientSearch(e.target.value);setForm(p=>({...p,source_id:''}));setRecipientOpen(true)}}
              onFocus={()=>setRecipientOpen(true)}
              placeholder="Buscar contacto o lead..." autoComplete="off"
              style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${selectedRecipient?P.purple:P.border}`,borderRadius:8,padding:'9px 12px',color:P.text,fontSize:13,outline:'none',width:'100%',fontFamily:'inherit',boxSizing:'border-box'}}/>
            {selectedRecipient&&<p style={{fontSize:11,color:P.purple,marginTop:4,margin:'4px 0 0',fontFamily:'monospace'}}>✓ {selectedRecipient.email}</p>}
            {recipientOpen&&recipientSearch.length>0&&(()=>{
              const q=recipientSearch.toLowerCase()
              const hits=allRecipients.filter(r=>(r.name||'').toLowerCase().includes(q)||(r.email||'').toLowerCase().includes(q)).slice(0,12)
              return hits.length>0?<div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:999,background:P.surface,border:`1px solid ${P.border}`,borderRadius:8,boxShadow:'0 8px 24px rgba(0,0,0,0.5)',maxHeight:220,overflowY:'auto',marginTop:2}}>
                {hits.map(r=><div key={r.id} onMouseDown={e=>{e.preventDefault();setForm(p=>({...p,source_id:r.id}));setRecipientSearch(r.name||r.email);setRecipientOpen(false)}}
                  style={{padding:'9px 14px',cursor:'pointer',borderBottom:`1px solid ${P.border}`,display:'flex',flexDirection:'column',gap:2}}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(108,92,231,0.12)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <span style={{fontSize:13,fontWeight:600,color:P.text}}>{r.name||r.email}</span>
                  <span style={{fontSize:11,color:P.muted,fontFamily:'monospace'}}>{r.email} · <span style={{color:r.type==='contact'?P.blue:P.orange}}>{r.type==='contact'?'contacto':'lead'}</span></span>
                </div>)}
              </div>:null
            })()}
          </div>
          {needsSubject&&<div><Lbl>Asunto *</Lbl><Input value={form.custom_subject} onChange={v=>setForm(p=>({...p,custom_subject:v}))} placeholder="Asunto del email"/></div>}
          <div>
            <Lbl>{form.template==='personalizado'?'Mensaje *':form.template==='accesos_crm'?'Contraseña provisional *':'Texto adicional (opcional)'}</Lbl>
            {form.template==='accesos_crm'&&<div style={{display:'flex',gap:8,marginBottom:8,alignItems:'center'}}>
              <div style={{flex:1,background:'rgba(255,255,255,0.04)',border:`1px solid ${P.border}`,borderRadius:8,padding:'7px 12px',fontFamily:'monospace',fontSize:13,color:form.extra_text?P.text:P.muted,letterSpacing:'0.08em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{form.extra_text||'Haz clic en Generar →'}</div>
              <button onClick={()=>{
                const upper='ABCDEFGHJKLMNPQRSTUVWXYZ',lower='abcdefghjkmnpqrstuvwxyz',digits='23456789',specials='@#!&$';
                const pick=(s)=>s[Math.floor(Math.random()*s.length)];
                const pool=upper+lower+digits+specials;
                let pwd=[pick(upper),pick(upper),pick(lower),pick(lower),pick(digits),pick(digits),pick(specials),...Array.from({length:5},()=>pick(pool))];
                for(let i=pwd.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pwd[i],pwd[j]]=[pwd[j],pwd[i]]}
                setForm(p=>({...p,extra_text:pwd.join('')}))
              }} style={{padding:'7px 14px',borderRadius:8,fontSize:12,cursor:'pointer',background:'rgba(37,99,235,0.15)',color:'#60a5fa',border:'1px solid rgba(37,99,235,0.3)',fontWeight:600,whiteSpace:'nowrap'}}>⚡ Generar</button>
              {form.extra_text&&<button onClick={()=>navigator.clipboard.writeText(form.extra_text).then(()=>alert('Contraseña copiada al portapapeles'))} style={{padding:'7px 10px',borderRadius:8,fontSize:12,cursor:'pointer',background:'rgba(255,255,255,0.04)',color:P.muted,border:`1px solid ${P.border}`}}>⎘</button>}
            </div>}
            <textarea value={form.extra_text} onChange={e=>setForm(p=>({...p,extra_text:e.target.value}))} placeholder={form.template==='personalizado'?'Escribe el mensaje completo...':form.template==='accesos_crm'?'O escribe una contraseña manualmente...':'Añade un párrafo personalizado que se insertará en la plantilla...'}
              style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${form.template==='accesos_crm'&&!form.extra_text?P.red:P.border}`,borderRadius:8,padding:12,color:P.text,fontSize:13,outline:'none',width:'100%',minHeight:form.template==='accesos_crm'?52:100,resize:'vertical',fontFamily:form.template==='accesos_crm'?'monospace':'inherit',letterSpacing:form.template==='accesos_crm'?'0.08em':'normal'}}/>
          </div>
          <div>
            <Lbl>Link reunión Teams (opcional)</Lbl>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:18}}>🎥</span>
              <Input value={form.teams_url} onChange={v=>setForm(p=>({...p,teams_url:v}))} placeholder="https://teams.microsoft.com/l/meetup-join/..."/>
            </div>
            {form.teams_url&&<p style={{fontSize:11,color:'#60a5fa',marginTop:4,margin:'4px 0 0'}}>✓ Se añadirá botón "Unirse a la reunión" en el email</p>}
          </div>
          <div>
            <Lbl>Adjuntos (PDF, imágenes · máx. 5MB c/u)</Lbl>
            <div onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)}
              onDrop={e=>{e.preventDefault();setDragOver(false);handleFiles(e.dataTransfer.files)}}
              style={{border:`2px dashed ${dragOver?P.purple:P.border}`,borderRadius:10,padding:'16px',textAlign:'center',background:dragOver?P.purpleDim:'rgba(255,255,255,0.02)',cursor:'pointer'}}
              onClick={()=>document.getElementById('fileInput').click()}>
              <p style={{fontSize:13,color:P.muted,margin:0}}>📎 Arrastra o <span style={{color:P.purple,fontWeight:600}}>haz clic</span></p>
              <input id="fileInput" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.docx" style={{display:'none'}} onChange={e=>handleFiles(e.target.files)}/>
            </div>
            {files.length>0&&<div style={{marginTop:8}}>
              {files.map((f,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 8px',background:P.purpleDim,border:`1px solid ${P.purpleBorder}`,borderRadius:6,marginBottom:4}}>
                <span style={{flex:1,fontSize:12,color:P.text}}>{f.filename}</span>
                <span style={{fontSize:11,color:P.muted}}>{(f.size/1024).toFixed(0)}KB</span>
                <button onClick={()=>setFiles(p=>p.filter((_,j)=>j!==i))} style={{background:'none',border:'none',color:P.muted,cursor:'pointer',fontSize:14}}>✕</button>
              </div>)}
            </div>}
          </div>
          {sent&&<div style={{padding:'10px 14px',borderRadius:8,background:sent.ok?P.greenDim:P.redDim,border:`1px solid ${sent.ok?P.green+'40':P.red+'40'}`,color:sent.ok?P.green:P.red,fontSize:13}}>{sent.msg}</div>}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:4}}>
            <div style={{display:'flex',alignItems:'center',gap:6,background:selectedTpl.color+'15',border:`1px solid ${selectedTpl.color}30`,borderRadius:6,padding:'5px 12px'}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:selectedTpl.color}}/><span style={{fontSize:11,color:selectedTpl.color,fontWeight:600}}>{selectedTpl.label}</span>
              {files.length>0&&<span style={{fontSize:11,color:P.muted}}>· {files.length} adj.</span>}
            </div>
            <div style={{display:'flex',gap:8}}>
              <Btn variant="ghost" onClick={()=>setShowModal(false)}>Cancelar</Btn>
              <Btn variant="blue" onClick={send} disabled={sending||!canSend}>{sending?'Enviando...':'Enviar ✉'}</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>}
  </div>
}


// ─── REPORT EXPORTS ───────────────────────────────────────────────────────────
// ─── EXPORT CONTACTOS (super admin only) ──────────────────────────────────────
function exportContactsCSV(contacts){
  const e=v=>`"${String(v||'').replace(/"/g,'""')}"`
  const rows=[
    ['Nombre','Email','Teléfono','Dirección','Estado','Origen','Capital USD','Asesor','Fecha'].map(e).join(','),
    ...contacts.map(c=>[
      c.full_name,c.email,c.phone||c.mobile||'',c.address||'',
      c.status,c.source||'crm',c._capital||c.investment_capital||'',
      c.user_id||'Web',c.created_at||c.submitted_at||''
    ].map(e).join(','))
  ]
  const a=document.createElement('a')
  a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(rows.join('\n'))
  a.download=`Pessaro_Contactos_${new Date().toISOString().slice(0,10)}.csv`;a.click()
}

function exportContactsExcel(contacts){
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const row=cells=>`<Row>${cells.map(c=>`<Cell><Data ss:Type="String">${esc(c)}</Data></Cell>`).join('')}</Row>`
  const rows=[
    row(['Nombre','Email','Teléfono','Dirección','Estado','Origen','Capital USD','Asesor','Fecha']),
    ...contacts.map(c=>row([
      c.full_name,c.email,c.phone||c.mobile||'',c.address||'',
      c.status,c.source||'crm',c._capital||c.investment_capital||'',
      c.user_id||'Web',c.created_at||c.submitted_at||''
    ]))
  ].join('')
  const xml=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Contactos"><Table>${rows}</Table></Worksheet></Workbook>`
  const a=document.createElement('a')
  a.href='data:application/vnd.ms-excel,'+encodeURIComponent(xml)
  a.download=`Pessaro_Contactos_${new Date().toISOString().slice(0,10)}.xls`;a.click()
}

function exportContactsHTML(contacts){
  const now=new Date().toLocaleDateString('es-CL',{day:'2-digit',month:'long',year:'numeric'})
  const fmtUSD=n=>n?new Intl.NumberFormat('es-CL',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n):''
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const sColor={activo:'#00d084',prospecto:'#ffa502',cliente:'#6c5ce7',inactivo:'#636e72'}
  const rows=contacts.map(c=>`
    <tr>
      <td><strong>${esc(c.full_name)}</strong></td>
      <td style="font-family:monospace;font-size:12px">${esc(c.email)}</td>
      <td>${esc(c.phone||c.mobile||'—')}</td>
      <td><span style="background:${sColor[c.status]||'#888'}22;color:${sColor[c.status]||'#888'};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${esc(c.status)}</span></td>
      <td style="font-size:11px;color:#64748b">${esc(c.source||'crm')}</td>
      <td style="font-family:monospace;color:#059669;font-weight:600">${fmtUSD(c._capital||c.investment_capital)}</td>
      <td style="font-size:11px;color:#94a3b8">${esc(c.created_at||c.submitted_at||'').slice(0,10)}</td>
    </tr>`).join('')
  const html=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Contactos — Pessaro Capital</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter',sans-serif;background:#f8fafc;color:#1e293b;padding:32px}
.header{background:linear-gradient(135deg,#050816,#1e3a8a);padding:24px 32px;border-radius:12px 12px 0 0;display:flex;align-items:center;justify-content:space-between;margin-bottom:0}
.header h1{color:#fff;font-size:18px;font-weight:700}.header small{color:#94a3b8;font-size:11px}
.meta{background:#1e3a8a;padding:10px 32px;border-bottom:3px solid #f0a500;margin-bottom:0}
.meta span{color:#e2e8f0;font-size:12px}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:0 0 12px 12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
th{background:#f1f5f9;color:#475569;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;padding:11px 16px;text-align:left;border-bottom:2px solid #e2e8f0}
td{padding:11px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;vertical-align:middle}
tr:last-child td{border-bottom:none}tr:hover td{background:#f8fafc}
.foot{margin-top:16px;text-align:right;font-size:11px;color:#94a3b8}
.btn{display:inline-block;background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:none;margin-bottom:16px;font-family:'Inter',sans-serif}
@media print{.btn{display:none}body{padding:0}}</style></head><body>
<button class="btn" onclick="window.print()">🖨 Imprimir / Guardar PDF</button>
<div class="header"><div><h1>📋 Contactos — Pessaro Capital</h1><small>CRM Interno · Uso confidencial</small></div><div style="text-align:right"><small style="color:#94a3b8">${now}</small><br><strong style="color:#f0a500;font-size:20px">${contacts.length}</strong><small style="color:#e2e8f0"> contactos</small></div></div>
<div class="meta"><span>Total: <strong>${contacts.length}</strong> · CRM + formularios web · Generado ${now}</span></div>
<table><thead><tr><th>Nombre</th><th>Email</th><th>Teléfono</th><th>Estado</th><th>Origen</th><th>Capital USD</th><th>Fecha</th></tr></thead>
<tbody>${rows}</tbody></table>
<div class="foot">Pessaro Capital SpA · crm.pessaro.cl · Confidencial — No distribuir</div>
</body></html>`
  const w=window.open('','_blank');w.document.write(html);w.document.close()
}

function exportContactsPDF(contacts,logoUri){
  const now=new Date().toLocaleDateString('es-CL',{day:'2-digit',month:'long',year:'numeric'})
  const fmtUSD=n=>n?new Intl.NumberFormat('es-CL',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n):''
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const sColor={activo:'#00d084',prospecto:'#ffa502',cliente:'#6c5ce7',inactivo:'#636e72'}
  const totalCap=contacts.reduce((s,c)=>s+(Number(c._capital||c.investment_capital)||0),0)
  const byStatus=Object.fromEntries(['activo','prospecto','cliente','inactivo'].map(s=>[s,contacts.filter(c=>c.status===s).length]))
  const rows=contacts.map(c=>`
    <tr>
      <td><strong>${esc(c.full_name)}</strong><br><span style="font-size:10px;color:#64748b;font-family:monospace">${esc(c.email)}</span></td>
      <td style="font-size:12px">${esc(c.phone||c.mobile||'—')}</td>
      <td><span style="background:${sColor[c.status]||'#888'}22;color:${sColor[c.status]||'#888'};padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600">${esc(c.status)}</span></td>
      <td style="font-size:11px;color:#64748b">${esc(c.source||'crm')}</td>
      <td style="font-family:monospace;color:#059669;font-weight:600;font-size:12px">${fmtUSD(c._capital||c.investment_capital)}</td>
      <td style="font-size:10px;color:#94a3b8">${esc(c.created_at||c.submitted_at||'').slice(0,10)}</td>
    </tr>`).join('')
  const html=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Informe Contactos — Pessaro Capital</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter',sans-serif;background:#f0f4f8;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.toolbar{background:#050816;padding:14px 32px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.08)}
.brand{display:flex;align-items:center;gap:12px}.brand img{width:36px;height:36px;border-radius:8px}
.brand strong{color:#fff;font-size:14px;display:block}.brand small{color:#94a3b8;font-size:10px;letter-spacing:1.5px;text-transform:uppercase}
.btns{display:flex;gap:10px}.btn{border:none;cursor:pointer;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;padding:9px 18px;border-radius:9px}
.btn-p{background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#fff;box-shadow:0 4px 14px rgba(37,99,235,.35)}
.btn-g{background:rgba(255,255,255,.06);color:#e6ecff;border:1px solid rgba(255,255,255,.14)}
@media print{.toolbar{display:none!important}body{background:#fff}.wrap{margin:0;padding:0}}
.wrap{max-width:960px;margin:24px auto 48px;padding:0 20px}
.card{background:#fff;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.18);overflow:hidden}
.band{background:linear-gradient(135deg,#050816 0%,#0a1f5c 40%,#1e3a8a 70%,#2563eb 100%);padding:24px 40px;display:flex;align-items:center;gap:16px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.band-logo{width:48px;height:48px;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,.2)}
.band-logo img{width:100%;height:100%;object-fit:cover}
.band h1{font-size:18px;font-weight:700;color:#fff}.band-sub{color:#b9c5e6;font-size:12px;margin-top:2px}
.band-right{margin-left:auto;text-align:right}
.band-right .val{color:#f0a500;font-size:28px;font-weight:800}.band-right small{color:#b9c5e6;font-size:11px}
.gold{height:4px;background:linear-gradient(135deg,#b8860b,#d4af37,#fbbf24);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.body{padding:28px 40px 24px}
.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:24px}
.kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center}
.kpi-lbl{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;color:#64748b;margin-bottom:4px}
.kpi-val{font-size:18px;font-weight:800;color:#0a1f5c}
table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#f1f5f9;color:#475569;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;padding:9px 12px;text-align:left;border-bottom:2px solid #e2e8f0}
td{padding:9px 12px;border-bottom:1px solid #f8fafc;vertical-align:middle}
tr:last-child td{border-bottom:none}
.disc{margin-top:20px;padding:10px 14px;background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;font-size:10px;color:#78350f;line-height:1.6;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.foot{margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center}
.foot-brand{display:flex;align-items:center;gap:8px}.foot-brand img{width:22px;height:22px;border-radius:4px}
.foot-brand span{font-size:11px;color:#94a3b8}.foot-note{font-size:10px;color:#cbd5e1;text-align:right;line-height:1.6}
</style></head><body>
<div class="toolbar">
  <div class="brand"><img src="${logoUri}" alt="Pessaro"><div><strong>Pessaro Capital</strong><small>CRM Interno</small></div></div>
  <div class="btns"><button class="btn btn-p" onclick="window.print()">🖨 Imprimir / Guardar PDF</button><button class="btn btn-g" onclick="window.close()">✕ Cerrar</button></div>
</div>
<div class="wrap"><div class="card">
  <div class="band">
    <div class="band-logo"><img src="${logoUri}" alt="Pessaro"></div>
    <div><h1>Informe de Contactos</h1><div class="band-sub">Pessaro Capital SpA · CRM Interno · ${now}</div></div>
    <div class="band-right"><div class="val">${contacts.length}</div><small>contactos totales</small></div>
  </div>
  <div class="gold"></div>
  <div class="body">
    <div class="kpis">
      <div class="kpi"><div class="kpi-lbl">Total</div><div class="kpi-val">${contacts.length}</div></div>
      <div class="kpi"><div class="kpi-lbl">Activos</div><div class="kpi-val" style="color:#00d084">${byStatus.activo||0}</div></div>
      <div class="kpi"><div class="kpi-lbl">Prospectos</div><div class="kpi-val" style="color:#ffa502">${byStatus.prospecto||0}</div></div>
      <div class="kpi"><div class="kpi-lbl">Clientes</div><div class="kpi-val" style="color:#6c5ce7">${byStatus.cliente||0}</div></div>
      <div class="kpi"><div class="kpi-lbl">Capital total</div><div class="kpi-val" style="color:#059669;font-size:13px">${fmtUSD(totalCap)}</div></div>
    </div>
    <table><thead><tr><th>Contacto</th><th>Teléfono</th><th>Estado</th><th>Origen</th><th>Capital USD</th><th>Fecha</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="disc">⚠️ <strong>Confidencial:</strong> Este informe es de uso interno exclusivo de Pessaro Capital SpA. Contiene datos personales protegidos. No distribuir.</div>
    <div class="foot">
      <div class="foot-brand"><img src="${logoUri}" alt="Pessaro"><span>Pessaro Capital SpA · pessaro.cl</span></div>
      <div class="foot-note">CRM Interno · ${now}<br>Confidencial — No distribuir</div>
    </div>
  </div>
</div></div></body></html>`
  const w=window.open('','_blank');w.document.write(html);w.document.close()
}

const RLOGO="data:image/webp;base64,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RmJJZD41MjUyNjU5MTQxNzk1ODA8L0F0dHJpYjpGYklkPgogICAgIDxBdHRyaWI6VG91Y2hUeXBlPjI8L0F0dHJpYjpUb3VjaFR5cGU+CiAgICA8L3JkZjpsaT4KICAgPC9yZGY6U2VxPgogIDwvQXR0cmliOkFkcz4KIDwvcmRmOkRlc2NyaXB0aW9uPgoKIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PScnCiAgeG1sbnM6ZGM9J2h0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvJz4KICA8ZGM6dGl0bGU+CiAgIDxyZGY6QWx0PgogICAgPHJkZjpsaSB4bWw6bGFuZz0neC1kZWZhdWx0Jz5mYXZpY29uLTI1NiAtIEljb25vIFBlc3Nhcm8gQ2FwaXRhbCA8L3JkZjpsaT4KICAgPC9yZGY6QWx0PgogIDwvZGM6dGl0bGU+CiA8L3JkZjpEZXNjcmlwdGlvbj4KCiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0nJwogIHhtbG5zOnBkZj0naHR0cDovL25zLmFkb2JlLmNvbS9wZGYvMS4zLyc+CiAgPHBkZjpBdXRob3I+RnJhbmNpc2NvIFJvamFzPC9wZGY6QXV0aG9yPgogPC9yZGY6RGVzY3JpcHRpb24+CgogPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9JycKICB4bWxuczp4bXA9J2h0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8nPgogIDx4bXA6Q3JlYXRvclRvb2w+Q2FudmEgZG9jPURBSEJDSFZaZ0xVIHVzZXI9VUFDZHdIZFdBRjAgYnJhbmQ9VmVydGljMyB0ZW1wbGF0ZT1CbHVlIE1vZGVybiBQcm9mZXNzaW9uYWwgTGV0dGVyIEsgTG9nbzwveG1wOkNyZWF0b3JUb29sPgogPC9yZGY6RGVzY3JpcHRpb24+CjwvcmRmOlJERj4KPC94OnhtcG1ldGE+Cjw/eHBhY2tldCBlbmQ9J3InPz4A"

function exportCSV(contacts,leads){
  const e=v=>`"${String(v||'').replace(/"/g,'""')}"`
  const rows=[
    ['FORMULARIOS','','','','','',''].join(','),
    ['Nombre','Email','Teléfono','Capital USD','Gestión','Estado','Fecha'].map(e).join(','),
    ...contacts.map(c=>[c.full_name,c.email,c.mobile||c.phone||'',c.investment_capital||c._capital||'',c.management_type||'',c.status,c.submitted_at||c.created_at||''].map(e).join(',')),
    '',
    ['PIPELINE LEADS','','','','','','','','','',''].join(','),
    ['Nombre','Email','Capital','Etapa','Equipo','Contactado','Cuenta','KYC','Depósito','Score','Fecha'].map(e).join(','),
    ...leads.map(l=>[l.full_name,l.email,l.investment_range||'',l.etapa,l.team||'',l.advisor_contacted?'Sí':'No',l.account_created?'Sí':'No',l.kyc_verified?'Sí':'No',l.deposit_confirmed?'Sí':'No',l.score||0,l.created_at||''].map(e).join(','))
  ]
  const a=document.createElement('a')
  a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(rows.join('\n'))
  a.download=`Pessaro_CRM_${new Date().toISOString().slice(0,10)}.csv`;a.click()
}

function exportExcel(contacts,leads){
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const row=cells=>`<Row>${cells.map(c=>`<Cell><Data ss:Type="String">${esc(c)}</Data></Cell>`).join('')}</Row>`
  const s1=[row(['Nombre','Email','Teléfono','Capital USD','Gestión','Estado','Fecha']),...contacts.map(c=>row([c.full_name,c.email,c.mobile||c.phone||'',c.investment_capital||c._capital||'',c.management_type||'',c.status,c.submitted_at||c.created_at||'']))].join('')
  const s2=[row(['Nombre','Email','Capital','Etapa','Equipo','Contactado','Cuenta','KYC','Depósito','Score','Fecha']),...leads.map(l=>row([l.full_name,l.email,l.investment_range||'',l.etapa,l.team||'',l.advisor_contacted?'Sí':'No',l.account_created?'Sí':'No',l.kyc_verified?'Sí':'No',l.deposit_confirmed?'Sí':'No',l.score||0,l.created_at||'']))].join('')
  const xml=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Formularios"><Table>${s1}</Table></Worksheet><Worksheet ss:Name="Pipeline"><Table>${s2}</Table></Worksheet></Workbook>`
  const a=document.createElement('a')
  a.href='data:application/vnd.ms-excel,'+encodeURIComponent(xml)
  a.download=`Pessaro_CRM_${new Date().toISOString().slice(0,10)}.xls`;a.click()
}

function openPDF(contacts,leads){
  const now=new Date().toLocaleDateString('es-CL',{day:'2-digit',month:'long',year:'numeric'})
  const fmtUSD=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n||0)
  const totalCap=contacts.reduce((s,c)=>s+(Number(c.investment_capital||c._capital)||0),0)
  const closed=leads.filter(l=>l.etapa===5).length
  const pct=(n,t)=>t?Math.round(n/t*100):0
  const etapaRows=[['Lead',1],['Contactado',2],['Propuesta',3],['Negociación',4],['Cerrado',5]].map(([lbl,e])=>{
    const n=leads.filter(l=>l.etapa===e).length
    return `<tr><td>${lbl}</td><td>${n}</td><td>${pct(n,leads.length)}%</td></tr>`
  }).join('')
  const statusRows=[['Sin leer','new','#f59e0b'],['Leídos','read','#3b82f6'],['Respondidos','replied','#10b981'],['Archivados','archived','#6b7280']].map(([lbl,s,col])=>{
    const n=contacts.filter(c=>c.status===s).length
    return `<tr><td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${col};margin-right:7px"></span>${lbl}</td><td>${n}</td><td>${pct(n,contacts.length)}%</td></tr>`
  }).join('')
  const convRows=[['Contactados',leads.filter(l=>l.advisor_contacted).length],['Cuenta creada',leads.filter(l=>l.account_created).length],['KYC verificado',leads.filter(l=>l.kyc_verified).length],['Depósito confirmado',leads.filter(l=>l.deposit_confirmed).length]].map(([lbl,n])=>`<tr><td>${lbl}</td><td>${n}</td><td>${pct(n,leads.length)}%</td></tr>`).join('')
  const html=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Informe CRM Pessaro Capital</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;background:#f0f4f8;color:#1f2937;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.toolbar{background:#050816;padding:14px 32px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.08)}
.brand{display:flex;align-items:center;gap:12px}
.brand img{width:38px;height:38px;border-radius:8px}
.brand strong{color:#fff;font-size:14px;display:block}
.brand small{color:#94a3b8;font-size:10px;letter-spacing:1.5px;text-transform:uppercase}
.btns{display:flex;gap:10px}
.btn{border:none;cursor:pointer;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;padding:9px 18px;border-radius:9px}
.btn-p{background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#fff;box-shadow:0 4px 14px rgba(37,99,235,.35)}
.btn-g{background:rgba(255,255,255,.06);color:#e6ecff;border:1px solid rgba(255,255,255,.14)}
@media print{.toolbar{display:none!important}body{background:#fff}.wrap{margin:0;padding:0}.card{border-radius:0;box-shadow:none}}
.wrap{max-width:900px;margin:24px auto 48px;padding:0 20px}
.card{background:#fff;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.28);overflow:hidden}
.band{background:linear-gradient(135deg,#050816 0%,#0a1f5c 35%,#1e3a8a 70%,#2563eb 100%);padding:28px 44px 22px;display:flex;align-items:center;gap:18px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.band-logo{width:54px;height:54px;border-radius:12px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);overflow:hidden;flex-shrink:0}
.band-logo img{width:100%;height:100%;object-fit:cover}
.band-lbl{font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#6190ff;font-weight:600;margin-bottom:4px}
.band h1{font-size:19px;font-weight:700;color:#fff}
.band-sub{color:#b9c5e6;font-size:12px;margin-top:3px}
.band-date{margin-left:auto;text-align:right}
.band-date .val{color:#e6ecff;font-size:13px;font-weight:600}
.gold{height:4px;background:linear-gradient(135deg,#b8860b,#d4af37,#fbbf24);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.body{padding:34px 44px 30px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:30px}
.kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:15px;text-align:center}
.kpi.dk{background:linear-gradient(135deg,#0a1f5c,#1e3a8a);border-color:#2563eb;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.kpi-lbl{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;margin-bottom:6px}
.kpi .kpi-lbl{color:#64748b}.kpi.dk .kpi-lbl{color:#93c5fd}
.kpi-val{font-size:20px;font-weight:800}
.kpi .kpi-val{color:#0a1f5c}.kpi.dk .kpi-val{color:#fff}
.kpi-sub{font-size:10px;margin-top:3px}
.kpi .kpi-sub{color:#94a3b8}.kpi.dk .kpi-sub{color:#7dd3fc}
.two{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px}
.sec{margin-bottom:24px}
.sec-title{font-size:10px;font-weight:700;color:#2563eb;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;padding-bottom:7px;border-bottom:2px solid #e2e8f0}
table{width:100%;border-collapse:collapse;font-size:13px}
th{background:#f1f5f9;color:#64748b;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;padding:9px 12px;text-align:left}
td{padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#1f2937}
tr:last-child td{border-bottom:none}
.disc{margin-top:22px;padding:11px 15px;background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;font-size:11px;color:#78350f;line-height:1.6;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.foot{margin-top:24px;padding-top:14px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center}
.foot-brand{display:flex;align-items:center;gap:8px}
.foot-brand img{width:24px;height:24px;border-radius:5px}
.foot-brand span{font-size:11px;color:#94a3b8}
.foot-note{font-size:10px;color:#cbd5e1;text-align:right;line-height:1.6}
</style></head><body>
<div class="toolbar">
  <div class="brand"><img src="${RLOGO}" alt="Pessaro"><div><strong>Pessaro Capital</strong><small>CRM Interno</small></div></div>
  <div class="btns"><button class="btn btn-p" onclick="window.print()">🖨 Imprimir / Guardar PDF</button><button class="btn btn-g" onclick="window.close()">✕ Cerrar</button></div>
</div>
<div class="wrap"><div class="card">
  <div class="band">
    <div class="band-logo"><img src="${RLOGO}" alt="Pessaro"></div>
    <div><div class="band-lbl">Informe de Gestión</div><h1>Reporte CRM — Pessaro Capital</h1><div class="band-sub">Generado automáticamente · Supabase</div></div>
    <div class="band-date"><div class="band-lbl">Fecha</div><div class="val">${now}</div></div>
  </div>
  <div class="gold"></div>
  <div class="body">
    <div class="kpis">
      <div class="kpi dk"><div class="kpi-lbl">Formularios</div><div class="kpi-val">${contacts.length}</div><div class="kpi-sub">Desde pessaro.cl</div></div>
      <div class="kpi dk"><div class="kpi-lbl">Capital declarado</div><div class="kpi-val">${fmtUSD(totalCap)}</div><div class="kpi-sub">Total acumulado</div></div>
      <div class="kpi"><div class="kpi-lbl">Leads pipeline</div><div class="kpi-val">${leads.length}</div><div class="kpi-sub">${closed} cerrados</div></div>
      <div class="kpi"><div class="kpi-lbl">Tasa de cierre</div><div class="kpi-val">${pct(closed,leads.length)}%</div><div class="kpi-sub">Conversión total</div></div>
    </div>
    <div class="two">
      <div class="sec"><div class="sec-title">Pipeline por etapa</div><table><thead><tr><th>Etapa</th><th>Leads</th><th>%</th></tr></thead><tbody>${etapaRows}</tbody></table></div>
      <div class="sec"><div class="sec-title">Estado formularios</div><table><thead><tr><th>Estado</th><th>Cantidad</th><th>%</th></tr></thead><tbody>${statusRows}</tbody></table></div>
    </div>
    <div class="sec"><div class="sec-title">Conversión del pipeline</div><table><thead><tr><th>Hito</th><th>Leads</th><th>% del total</th></tr></thead><tbody>${convRows}</tbody></table></div>
    <div class="disc">⚠️ <strong>Aviso de riesgo:</strong> Este informe es de uso interno exclusivo de Pessaro Capital SpA. La rentabilidad pasada no garantiza resultados futuros. Toda inversión implica riesgo de pérdida.</div>
    <div class="foot"><div class="foot-brand"><img src="${RLOGO}" alt="Pessaro"><span>Pessaro Capital SpA · pessaro.cl</span></div><div class="foot-note">CRM Interno · ${now}<br>Confidencial — No distribuir</div></div>
  </div>
</div></div></body></html>`
  const w=window.open('','_blank')
  w.document.write(html)
  w.document.close()
}

// ─── REPORTS ──────────────────────────────────────────────────────────────────
function Reports({contacts,leads}){
  const closed=leads.filter(l=>l.etapa===5).length
  const totalCap=contacts.reduce((s,c)=>s+(Number(c.investment_capital||c._capital)||0),0)
  const pipeData=STAGES.map(s=>({name:STAGE_LABEL[s],v:leads.filter(l=>ETAPA_STAGE[l.etapa]===s).length}))
  const capData=['1k-5k','5k-20k','20k-50k','50k+'].map(r=>({name:r,v:leads.filter(l=>l.investment_range===r).length}))
  return <div>
    <SHdr title="Reportes" sub="Analíticas en tiempo real"
      action={<div style={{display:'flex',gap:8}}>
        <Btn variant="ghost" onClick={()=>exportCSV(contacts,leads)} style={{fontSize:12}}>⬇ CSV</Btn>
        <Btn variant="ghost" onClick={()=>exportExcel(contacts,leads)} style={{fontSize:12}}>⬇ Excel</Btn>
        <Btn onClick={()=>openPDF(contacts,leads)} style={{fontSize:12,background:'linear-gradient(135deg,#0a1f5c,#2563eb)',color:'#fff',border:'none',boxShadow:'0 4px 14px rgba(37,99,235,.35)'}}>🖨 PDF corporativo</Btn>
      </div>}/>
    <div style={{display:'flex',gap:14,marginBottom:22,flexWrap:'wrap'}}>
      <StatCard label="Formularios" value={contacts.length} accent={P.purple} Icon="📋"/>
      <StatCard label="Capital declarado" value={fmt(totalCap)} accent={P.green} Icon="💵"/>
      <StatCard label="Leads totales" value={leads.length} accent={P.blue} Icon="◈"/>
      <StatCard label="Cerrados" value={closed} accent={P.orange} Icon="✓"/>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,marginBottom:18}}>
      <GlassCard>
        <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:16,margin:'0 0 16px'}}>Leads por etapa</p>
        <ErrorBoundary><ResponsiveContainer width="100%" height={190}><BarChart data={pipeData} barSize={24}><XAxis dataKey="name" tick={{fill:P.muted,fontSize:10}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip {...TT} formatter={v=>[v,'Leads']}/><Bar dataKey="v" fill={P.purple} radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></ErrorBoundary>
      </GlassCard>
      <GlassCard>
        <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:16,margin:'0 0 16px'}}>Leads por capital</p>
        <ErrorBoundary><ResponsiveContainer width="100%" height={190}><BarChart data={capData} barSize={24}><XAxis dataKey="name" tick={{fill:P.muted,fontSize:10}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip {...TT} formatter={v=>[v,'Leads']}/><Bar dataKey="v" fill={P.blue} radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></ErrorBoundary>
      </GlassCard>
    </div>
    <GlassCard>
      <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:16,margin:'0 0 16px'}}>Conversión del pipeline</p>
      <div style={{display:'flex',gap:14,flexWrap:'wrap'}}>
        {[['Contactados',leads.filter(l=>l.advisor_contacted).length,P.blue],['Cuenta',leads.filter(l=>l.account_created).length,P.purple],['KYC',leads.filter(l=>l.kyc_verified).length,P.orange],['Depósito',leads.filter(l=>l.deposit_confirmed).length,P.green]].map(([k,v,c])=>(
          <div key={k} style={{flex:1,minWidth:110,textAlign:'center',padding:'18px 10px',borderRadius:12,background:`${c}10`,border:`1px solid ${c}25`}}>
            <div style={{fontSize:30,fontWeight:800,color:c,fontFamily:'monospace'}}>{v}</div>
            <div style={{fontSize:11,color:P.muted,marginTop:6,textTransform:'uppercase',letterSpacing:'0.08em'}}>{k}</div>
          </div>
        ))}
      </div>
    </GlassCard>
  </div>
}


// ─── EQUIPO ───────────────────────────────────────────────────────────────────
// ─── EQUIPO UNIFICADO (Equipo + TeamAdmin fusionados) ────────────────────────
function Equipo({user,isSuperAdmin,teamId}){
  // ── State ────────────────────────────────────────────────────────────────
  const[staff,setStaff]         =useState([])
  const[teams,setTeams]         =useState([])
  const[modules,setModules]     =useState([])
  const[teamTools,setTeamTools] =useState({})
  const[loading,setLoading]     =useState(true)
  const[tab,setTab]             =useState('miembros') // 'miembros' | 'equipos'
  const[showInvite,setShowInvite]=useState(false)
  const[editMember,setEditMember]=useState(null)
  const[selTeam,setSelTeam]     =useState(null)
  const[showNewTeam,setShowNewTeam]=useState(false)
  const[newTeamName,setNewTeamName]=useState('')
  const[sending,setSending]     =useState(false)
  const[saving,setSaving]       =useState(false)
  const[flash,setFlash]         =useState(null)
  const[search,setSearch]       =useState('')
  const[filterRole,setFilterRole]=useState('todos')
  const[form,setForm]=useState({email:'',display_name:'',title:'Asesor · Pessaro Capital',pessaro_email:'',phone:'',role:'asesor',team_id:''})
  const[editForm,setEditForm]   =useState({})

  const showMsg=(msg,ok=true)=>{setFlash({msg,ok});setTimeout(()=>setFlash(null),3500)}

  // ── Load ─────────────────────────────────────────────────────────────────
  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const queries=[
        supabase.from('crm_staff_profiles').select('*,crm_teams(id,name)').order('display_name'),
        supabase.from('crm_teams').select('*').order('name'),
        supabase.from('crm_modules').select('*').order('sort_order'),
        supabase.from('team_tools').select('*'),
      ]
      if(!isSuperAdmin && teamId){
        queries[0]=supabase.from('crm_staff_profiles').select('*,crm_teams(id,name)').eq('team_id',teamId).order('display_name')
      }
      const[{data:s},{data:t},{data:m},{data:tt}]=await Promise.all(queries)
      setStaff(s||[])
      setTeams(t||[])
      setModules(m||[])
      const map={}
      ;(tt||[]).forEach(r=>{
        if(!map[r.team_id]) map[r.team_id]=new Set()
        if(r.enabled) map[r.team_id].add(r.module_id)
      })
      setTeamTools(map)
      if(!selTeam && t?.length>0) setSelTeam(t[0].id)
    }catch(e){console.error('equipo load:',e)}
    finally{setLoading(false)}
  },[isSuperAdmin,teamId])

  useEffect(()=>{load()},[load])

  // ── Invite ────────────────────────────────────────────────────────────────
  const invite=async()=>{
    if(!form.email||!form.display_name)return
    setSending(true)
    try{
      const{data:{session}}=await supabase.auth.getSession()
      const res=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm_invite_user`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
        body:JSON.stringify({...form,team_id:form.team_id||teamId||null})
      })
      const d=await res.json()
      if(d.ok){showMsg('Invitación enviada ✓');setShowInvite(false);setForm({email:'',display_name:'',title:'Asesor · Pessaro Capital',pessaro_email:'',phone:'',role:'asesor',team_id:''});await load()}
      else showMsg(d.error||'Error al invitar',false)
    }catch(e){showMsg(e.message,false)}
    setSending(false)
  }

  // ── Edit member ───────────────────────────────────────────────────────────
  const openEdit=(s)=>{
    setEditMember(s)
    setEditForm({display_name:s.display_name,title:s.title||'',pessaro_email:s.pessaro_email||'',phone:s.phone||'',role:s.role||'asesor',team_id:s.team_id||''})
  }

  const saveMember=async()=>{
    if(!editMember)return
    setSaving(true)
    try{
      await supabase.from('crm_staff_profiles').update({
        display_name:editForm.display_name,
        title:editForm.title,
        pessaro_email:editForm.pessaro_email,
        phone:editForm.phone,
        role:editForm.role,
        team_id:editForm.team_id||null,
      }).eq('user_id',editMember.user_id)
      showMsg('Miembro actualizado ✓')
      setEditMember(null)
      await load()
    }catch(e){showMsg('Error: '+e.message,false)}
    setSaving(false)
  }

  // ── Team tools ────────────────────────────────────────────────────────────
  const toggleTool=async(teamId,moduleId,current)=>{
    const enabled=!current
    try{
      await supabase.from('team_tools').upsert(
        {team_id:teamId,module_id:moduleId,enabled,updated_by:user.id},
        {onConflict:'team_id,module_id'}
      )
      setTeamTools(prev=>{
        const m=new Set(prev[teamId]||[])
        enabled?m.add(moduleId):m.delete(moduleId)
        return{...prev,[teamId]:m}
      })
    }catch(e){showMsg('Error al guardar',false)}
  }

  // ── Create team ───────────────────────────────────────────────────────────
  const createTeam=async()=>{
    if(!newTeamName.trim())return
    setSaving(true)
    try{
      const{data,error}=await supabase.from('crm_teams').insert({name:newTeamName.trim(),created_by:user.id}).select().single()
      if(error) throw error
      const rows=modules.map(m=>({team_id:data.id,module_id:m.id,enabled:true,updated_by:user.id}))
      if(rows.length) await supabase.from('team_tools').insert(rows)
      setNewTeamName('');setShowNewTeam(false)
      await load()
      setSelTeam(data.id)
      showMsg('Equipo creado ✓')
    }catch(e){showMsg('Error: '+e.message,false)}
    setSaving(false)
  }

  // ── Assign advisor to team ────────────────────────────────────────────────
  const assignAdvisor=async(userId,newTeamId)=>{
    try{
      await supabase.from('crm_staff_profiles').update({team_id:newTeamId||null}).eq('user_id',userId)
      setStaff(prev=>prev.map(s=>s.user_id===userId?{...s,team_id:newTeamId||null,crm_teams:teams.find(t=>t.id===newTeamId)||null}:s))
      showMsg('Asignación actualizada ✓')
    }catch(e){showMsg('Error al asignar',false)}
  }

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered=staff.filter(s=>{
    const q=search.toLowerCase()
    const matchQ=!q||(s.display_name||'').toLowerCase().includes(q)||(s.pessaro_email||'').toLowerCase().includes(q)
    const matchR=filterRole==='todos'||s.role===filterRole
    return matchQ&&matchR
  })

  // ── Helpers ───────────────────────────────────────────────────────────────
  const roleLabel={super_admin:'Super Admin',broker:'Administrador',asesor:'Asesor'}
  const roleColor={super_admin:P.orange,broker:P.blue,asesor:P.purple}
  const roleBg   ={super_admin:P.orangeDim,broker:P.blueDim,asesor:P.purpleDim}
  const RoleBadge=({role})=>{
    const r=role||'asesor'
    return <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:4,
      background:roleBg[r]||P.purpleDim,color:roleColor[r]||P.purple,
      border:`1px solid ${(roleColor[r]||P.purple)}30`}}>{roleLabel[r]||r}</span>
  }

  const selTeamData =teams.find(t=>t.id===selTeam)
  const selTeamStaff=staff.filter(s=>s.team_id===selTeam)
  const unassigned  =staff.filter(s=>!s.team_id)
  const enabledMods =teamTools[selTeam]||new Set()

  // ── Tabs (solo super admin ve ambos tabs) ─────────────────────────────────
  const TABS=isSuperAdmin
    ?[{id:'miembros',label:'👥 Miembros'},{id:'equipos',label:'⬡ Equipos'}]
    :[{id:'miembros',label:'👥 Mi Equipo'}]

  return <div>
    {/* Header */}
    <SHdr
      title={isSuperAdmin?'Gestión de Equipo':'Mi Equipo'}
      sub={`${staff.length} miembro${staff.length!==1?'s':''} · ${teams.length} equipo${teams.length!==1?'s':''}`}
      action={<div style={{display:'flex',gap:8}}>
        {tab==='equipos'&&isSuperAdmin&&<Btn onClick={()=>setShowNewTeam(true)}>+ Nuevo equipo</Btn>}
        {tab==='miembros'&&<Btn onClick={()=>setShowInvite(true)}>✉ Invitar miembro</Btn>}
      </div>}/>

    {/* Flash */}
    {flash&&<div style={{marginBottom:16,padding:'10px 16px',borderRadius:8,fontSize:13,
      background:flash.ok?P.greenDim:P.redDim,
      border:`1px solid ${flash.ok?P.green:P.red}30`,
      color:flash.ok?P.green:P.red}}>{flash.msg}</div>}

    {/* Tabs */}
    {isSuperAdmin&&<div style={{display:'flex',gap:4,marginBottom:20,borderBottom:`1px solid ${P.border}`,paddingBottom:0}}>
      {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)}
        style={{padding:'9px 18px',fontSize:13,fontWeight:tab===t.id?700:400,cursor:'pointer',
          background:'none',border:'none',borderBottom:tab===t.id?`2px solid ${P.purple}`:'2px solid transparent',
          color:tab===t.id?P.purple:P.muted,marginBottom:-1,transition:'all 0.1s'}}>
        {t.label}
      </button>)}
    </div>}

    {loading?<Spinner/>:<>

    {/* ══ TAB: MIEMBROS ══ */}
    {tab==='miembros'&&<>

      {/* KPIs super admin */}
      {isSuperAdmin&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:12,marginBottom:20}}>
        {[
          ['Total miembros',staff.length,P.purple],
          ['Super Admins',staff.filter(s=>s.role==='super_admin').length,P.orange],
          ['Administradores',staff.filter(s=>s.role==='broker').length,P.blue],
          ['Asesores',staff.filter(s=>s.role==='asesor').length,P.green],
          ['Equipos',teams.length,P.muted],
        ].map(([l,v,c])=><div key={l} style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:12,padding:'14px 16px'}}>
          <div style={{fontSize:22,fontWeight:800,color:c}}>{v}</div>
          <div style={{fontSize:11,color:P.muted,marginTop:3}}>{l}</div>
        </div>)}
      </div>}

      {/* Filtros */}
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nombre o email..."
          style={{flex:1,minWidth:200,background:'rgba(255,255,255,0.04)',border:`1px solid ${P.border}`,borderRadius:8,padding:'8px 12px',color:P.text,fontSize:13,outline:'none'}}/>
        {isSuperAdmin&&<div style={{display:'flex',gap:6}}>
          {['todos','asesor','broker','super_admin'].map(r=><button key={r} onClick={()=>setFilterRole(r)}
            style={{padding:'7px 12px',borderRadius:8,fontSize:12,cursor:'pointer',fontWeight:filterRole===r?600:400,
              background:filterRole===r?P.purpleDim:'rgba(255,255,255,0.04)',
              color:filterRole===r?P.purple:P.muted,
              border:`1px solid ${filterRole===r?P.purpleBorder:P.border}`}}>
            {r==='todos'?'Todos':r==='broker'?'Admins':r==='super_admin'?'Super Admin':'Asesores'}
          </button>)}
        </div>}
      </div>

      {/* Tabla miembros */}
      {filtered.length===0
        ?<div style={{textAlign:'center',padding:48,color:P.muted,fontSize:13}}>Sin miembros encontrados</div>
        :<div style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:12,overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${P.border}`}}>
                {['Miembro','Cargo','Rol','Equipo',isSuperAdmin?'Acciones':''].filter(Boolean).map(h=>
                  <th key={h} style={{padding:'11px 16px',textAlign:'left',fontSize:10,color:P.muted,
                    textTransform:'uppercase',letterSpacing:'0.10em',fontWeight:600}}>{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s,i)=><tr key={s.user_id}
                style={{borderBottom:i<filtered.length-1?`1px solid ${P.border}`:'none'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(108,92,231,0.04)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>

                {/* Avatar + nombre */}
                <td style={{padding:'12px 16px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:36,height:36,borderRadius:9,background:roleBg[s.role]||P.purpleDim,
                      display:'flex',alignItems:'center',justifyContent:'center',
                      fontSize:14,fontWeight:700,color:roleColor[s.role]||P.purple,flexShrink:0}}>
                      {(s.display_name||'?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:P.text}}>{s.display_name||'Sin nombre'}</div>
                      <div style={{fontSize:11,color:P.muted,fontFamily:'monospace'}}>{s.pessaro_email||'—'}</div>
                    </div>
                  </div>
                </td>

                <td style={{padding:'12px 16px',fontSize:12,color:P.textSub}}>{s.title||'—'}</td>
                <td style={{padding:'12px 16px'}}><RoleBadge role={s.role}/></td>

                {/* Equipo — con selector inline si es super admin */}
                <td style={{padding:'12px 16px'}}>
                  {isSuperAdmin
                    ?<select
                        value={s.team_id||''}
                        onChange={e=>assignAdvisor(s.user_id,e.target.value||null)}
                        style={{background:'rgba(255,255,255,0.04)',border:`1px solid ${P.border}`,borderRadius:6,
                          padding:'4px 8px',color:s.team_id?P.blue:P.muted,fontSize:12,outline:'none',cursor:'pointer'}}>
                        <option value="">Sin equipo</option>
                        {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    :s.crm_teams?.name
                      ?<span style={{fontSize:12,padding:'3px 8px',borderRadius:5,background:P.blueDim,color:P.blue,border:`1px solid ${P.blue}30`}}>{s.crm_teams.name}</span>
                      :<span style={{fontSize:12,color:P.muted}}>Sin equipo</span>
                  }
                </td>

                {/* Editar — solo super admin */}
                {isSuperAdmin&&<td style={{padding:'12px 16px'}}>
                  <button onClick={()=>openEdit(s)}
                    style={{padding:'5px 12px',borderRadius:6,fontSize:12,cursor:'pointer',
                      background:P.purpleDim,color:P.purple,border:`1px solid ${P.purpleBorder}`,fontWeight:600}}>
                    ✎ Editar
                  </button>
                </td>}
              </tr>)}
            </tbody>
          </table>
        </div>
      }
    </>}

    {/* ══ TAB: EQUIPOS ══ */}
    {tab==='equipos'&&isSuperAdmin&&<>

      {/* Nuevo equipo form */}
      {showNewTeam&&<GlassCard style={{marginBottom:16,padding:16}}>
        <p style={{fontSize:13,fontWeight:600,color:P.text,margin:'0 0 12px'}}>Nuevo equipo</p>
        <div style={{display:'flex',gap:8}}>
          <input value={newTeamName} onChange={e=>setNewTeamName(e.target.value)}
            placeholder="Nombre del equipo..."
            style={{flex:1,background:'rgba(255,255,255,0.04)',border:`1px solid ${P.border}`,borderRadius:8,padding:'8px 12px',color:P.text,fontSize:13,outline:'none'}}/>
          <Btn onClick={createTeam} disabled={saving}>{saving?'Creando...':'Crear'}</Btn>
          <Btn variant="ghost" onClick={()=>{setShowNewTeam(false);setNewTeamName('')}}>Cancelar</Btn>
        </div>
      </GlassCard>}

      {teams.length===0
        ?<div style={{textAlign:'center',padding:48,color:P.muted,fontSize:13}}>Sin equipos aún</div>
        :<div style={{display:'grid',gridTemplateColumns:'220px 1fr',gap:16}}>

          {/* Lista de equipos */}
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {teams.map(t=><button key={t.id} onClick={()=>setSelTeam(t.id)}
              style={{padding:'10px 14px',borderRadius:8,textAlign:'left',cursor:'pointer',
                background:selTeam===t.id?P.purpleDim:'rgba(255,255,255,0.03)',
                border:`1px solid ${selTeam===t.id?P.purpleBorder:P.border}`,
                color:selTeam===t.id?P.purple:P.text,fontSize:13,fontWeight:selTeam===t.id?600:400}}>
              <div>{t.name}</div>
              <div style={{fontSize:11,color:P.muted,marginTop:2}}>{staff.filter(s=>s.team_id===t.id).length} miembro{staff.filter(s=>s.team_id===t.id).length!==1?'s':''}</div>
            </button>)}
          </div>

          {/* Detalle del equipo seleccionado */}
          {selTeamData?<div style={{display:'flex',flexDirection:'column',gap:14}}>

            {/* Herramientas habilitadas */}
            <GlassCard>
              <p style={{fontSize:11,fontWeight:700,color:P.muted,textTransform:'uppercase',letterSpacing:'0.1em',margin:'0 0 14px'}}>🔧 Herramientas habilitadas</p>
              {modules.length===0
                ?<p style={{fontSize:12,color:P.muted}}>Sin módulos configurados</p>
                :<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:8}}>
                  {modules.map(m=>{
                    const on=enabledMods.has(m.id)
                    return <button key={m.id} onClick={()=>toggleTool(selTeam,m.id,on)}
                      style={{padding:'8px 12px',borderRadius:8,cursor:'pointer',textAlign:'left',
                        background:on?P.purpleDim:'rgba(255,255,255,0.03)',
                        border:`1px solid ${on?P.purpleBorder:P.border}`,
                        color:on?P.purple:P.muted,fontSize:12,fontWeight:on?600:400,
                        display:'flex',alignItems:'center',gap:6}}>
                      <span>{on?'✓':'○'}</span>
                      <span>{m.icon} {m.label}</span>
                    </button>
                  })}
                </div>
              }
            </GlassCard>

            {/* Miembros del equipo */}
            <GlassCard>
              <p style={{fontSize:11,fontWeight:700,color:P.muted,textTransform:'uppercase',letterSpacing:'0.1em',margin:'0 0 14px'}}>👥 Miembros del equipo ({selTeamStaff.length})</p>
              {selTeamStaff.length===0
                ?<p style={{fontSize:13,color:P.muted}}>Sin miembros asignados</p>
                :selTeamStaff.map(s=><div key={s.user_id}
                  style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 0',borderBottom:`1px solid ${P.border}`}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:30,height:30,borderRadius:7,background:roleBg[s.role]||P.purpleDim,
                      display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:roleColor[s.role]||P.purple}}>
                      {(s.display_name||'?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:P.text}}>{s.display_name}</div>
                      <div style={{fontSize:11,color:P.muted,fontFamily:'monospace'}}>{s.pessaro_email}</div>
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <RoleBadge role={s.role}/>
                    <button onClick={()=>assignAdvisor(s.user_id,null)}
                      style={{fontSize:11,padding:'3px 10px',borderRadius:6,cursor:'pointer',background:P.redDim,border:`1px solid ${P.red}30`,color:P.red}}>
                      Quitar
                    </button>
                  </div>
                </div>)
              }
            </GlassCard>

            {/* Sin equipo — para asignar al equipo seleccionado */}
            {unassigned.length>0&&<GlassCard>
              <p style={{fontSize:11,fontWeight:700,color:P.muted,textTransform:'uppercase',letterSpacing:'0.1em',margin:'0 0 14px'}}>⚠ Sin equipo asignado ({unassigned.length})</p>
              {unassigned.map(s=><div key={s.user_id}
                style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 0',borderBottom:`1px solid ${P.border}`}}>
                <div>
                  <span style={{fontSize:13,fontWeight:600,color:P.text}}>{s.display_name}</span>
                  <span style={{fontSize:11,color:P.muted,marginLeft:8,fontFamily:'monospace'}}>{s.pessaro_email}</span>
                </div>
                <button onClick={()=>assignAdvisor(s.user_id,selTeam)}
                  style={{fontSize:11,padding:'3px 10px',borderRadius:6,cursor:'pointer',background:P.purpleDim,border:`1px solid ${P.purpleBorder}`,color:P.purple}}>
                  + Asignar a {selTeamData.name}
                </button>
              </div>)}
            </GlassCard>}

          </div>:<p style={{color:P.muted,fontSize:13}}>Selecciona un equipo</p>}
        </div>
      }
    </>}

    </>}

    {/* ── Modal: Invitar nuevo miembro ── */}
    {showInvite&&<Modal title="Invitar nuevo miembro" onClose={()=>setShowInvite(false)} accent={P.green}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div style={{padding:'10px 14px',background:P.greenDim,border:`1px solid ${P.green}30`,borderRadius:8}}>
          <p style={{fontSize:12,color:P.green,margin:0}}>Se enviará un email de invitación. El usuario establece su contraseña y accede al CRM.</p>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><Lbl>Email personal *</Lbl><Input value={form.email} onChange={v=>setForm(p=>({...p,email:v}))} placeholder="usuario@gmail.com" type="email"/></div>
          <div><Lbl>Nombre completo *</Lbl><Input value={form.display_name} onChange={v=>setForm(p=>({...p,display_name:v}))} placeholder="Juan García"/></div>
          <div><Lbl>Email @pessaro.cl</Lbl><Input value={form.pessaro_email} onChange={v=>setForm(p=>({...p,pessaro_email:v}))} placeholder="juan@pessaro.cl" type="email"/></div>
          <div><Lbl>Teléfono</Lbl><Input value={form.phone} onChange={v=>setForm(p=>({...p,phone:v}))} placeholder="+56 9 1234 5678"/></div>
          <div style={{gridColumn:'1/-1'}}><Lbl>Cargo</Lbl><Input value={form.title} onChange={v=>setForm(p=>({...p,title:v}))} placeholder="Asesor · Pessaro Capital"/></div>
          {isSuperAdmin&&<>
            <div><Lbl>Rol en el sistema</Lbl>
              <select value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))}
                style={{width:'100%',background:'rgba(255,255,255,0.04)',border:`1px solid ${P.border}`,borderRadius:8,padding:'9px 12px',color:P.text,fontSize:13,outline:'none'}}>
                <option value="asesor">Asesor</option>
                <option value="broker">Administrador</option>
              </select>
            </div>
            <div><Lbl>Equipo</Lbl>
              <select value={form.team_id} onChange={e=>setForm(p=>({...p,team_id:e.target.value}))}
                style={{width:'100%',background:'rgba(255,255,255,0.04)',border:`1px solid ${P.border}`,borderRadius:8,padding:'9px 12px',color:P.text,fontSize:13,outline:'none'}}>
                <option value="">Sin equipo</option>
                {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </>}
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',paddingTop:8}}>
          <Btn variant="ghost" onClick={()=>setShowInvite(false)}>Cancelar</Btn>
          <Btn onClick={invite} disabled={sending||!form.email||!form.display_name}>{sending?'Enviando...':'Enviar invitación ✉'}</Btn>
        </div>
      </div>
    </Modal>}

    {/* ── Modal: Editar miembro ── */}
    {editMember&&<Modal title={`Editar · ${editMember.display_name}`} onClose={()=>setEditMember(null)} accent={P.purple}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div style={{gridColumn:'1/-1'}}><Lbl>Nombre completo</Lbl><Input value={editForm.display_name} onChange={v=>setEditForm(p=>({...p,display_name:v}))} placeholder="Nombre completo"/></div>
          <div><Lbl>Email @pessaro.cl</Lbl><Input value={editForm.pessaro_email} onChange={v=>setEditForm(p=>({...p,pessaro_email:v}))} type="email"/></div>
          <div><Lbl>Teléfono</Lbl><Input value={editForm.phone} onChange={v=>setEditForm(p=>({...p,phone:v}))}/></div>
          <div style={{gridColumn:'1/-1'}}><Lbl>Cargo</Lbl><Input value={editForm.title} onChange={v=>setEditForm(p=>({...p,title:v}))}/></div>
          <div>
            <Lbl>Rol del sistema</Lbl>
            <select value={editForm.role} onChange={e=>setEditForm(p=>({...p,role:e.target.value}))}
              style={{width:'100%',background:'rgba(255,255,255,0.04)',border:`1px solid ${P.border}`,borderRadius:8,padding:'9px 12px',color:P.text,fontSize:13,outline:'none'}}>
              <option value="asesor">Asesor</option>
              <option value="broker">Administrador</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <div>
            <Lbl>Equipo asignado</Lbl>
            <select value={editForm.team_id} onChange={e=>setEditForm(p=>({...p,team_id:e.target.value}))}
              style={{width:'100%',background:'rgba(255,255,255,0.04)',border:`1px solid ${P.border}`,borderRadius:8,padding:'9px 12px',color:P.text,fontSize:13,outline:'none'}}>
              <option value="">Sin equipo</option>
              {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{padding:'10px 14px',background:P.orangeDim,border:`1px solid ${P.orange}30`,borderRadius:8}}>
          <p style={{fontSize:11,color:P.orange,margin:0}}>⚠ Cambiar el rol actualiza los permisos de acceso inmediatamente.</p>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',paddingTop:4}}>
          <Btn variant="ghost" onClick={()=>setEditMember(null)}>Cancelar</Btn>
          <Btn onClick={saveMember} disabled={saving}>{saving?'Guardando...':'Guardar cambios'}</Btn>
        </div>
      </div>
    </Modal>}
  </div>
}

// ─── BROKER VIEW ─────────────────────────────────────────────────────────────
function BrokerView({user,campaigns,leads,isSuperAdmin}){
  const[assignments,setAssignments]=useState([])
  const[loading,setLoading]=useState(true)
  const[tab,setTab]=useState('campanas')

  useEffect(()=>{
    const load=async()=>{
      setLoading(true)
      try{
        const{data}=await supabase.from('broker_assignments')
          .select('*,campaigns(id,name),crm_staff_profiles!advisor_user_id(display_name,pessaro_email)')
          .eq('broker_user_id',user.id)
        setAssignments(data||[])
      }catch(e){console.error('broker load:',e)}
      finally{setLoading(false)}
    }
    load()
  },[user.id])

  const assignedCampaignIds=new Set(assignments.filter(a=>a.campaign_id).map(a=>a.campaign_id))
  const assignedAdvisorIds=new Set(assignments.filter(a=>a.advisor_user_id).map(a=>a.advisor_user_id))
  const myCampaigns=campaigns.filter(c=>assignedCampaignIds.has(c.id))
  const myLeads=leads.filter(l=>assignedAdvisorIds.has(l.advisor_assigned)||assignedCampaignIds.size===0)

  const etapaLabel={1:'Registro',2:'Contactado',3:'Cuenta',4:'KYC',5:'Depósito'}
  const etapaColor={1:P.muted,2:P.blue,3:P.orange,4:P.purple,5:P.green}

  return <div style={{minHeight:'100vh',background:P.bg,padding:'28px 32px'}}>
    <div style={{marginBottom:24,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
      <div>
        <h1 style={{margin:0,fontSize:22,fontWeight:800,color:P.text}}>Panel Broker</h1>
        <p style={{margin:'4px 0 0',fontSize:13,color:P.muted}}>Vista supervisora — Pessaro Capital</p>
      </div>
      <div style={{padding:'4px 12px',background:P.orangeDim,border:`1px solid ${P.orange}30`,borderRadius:8}}>
        <span style={{fontSize:11,color:P.orange,fontWeight:700}}>⬡ Broker</span>
      </div>
    </div>

    {/* KPIs */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12,marginBottom:24}}>
      {[
        ['Campañas asignadas', myCampaigns.length, P.purple],
        ['Asesores supervisados', assignedAdvisorIds.size, P.blue],
        ['Leads totales', myLeads.length, P.green],
        ['Con depósito', myLeads.filter(l=>l.deposit_confirmed).length, P.orange],
      ].map(([label,val,color])=>(
        <div key={label} style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:12,padding:'16px 18px'}}>
          <div style={{fontSize:22,fontWeight:800,color}}>{val}</div>
          <div style={{fontSize:12,color:P.muted,marginTop:4}}>{label}</div>
        </div>
      ))}
    </div>

    {/* Tabs */}
    <div style={{display:'flex',gap:8,marginBottom:20}}>
      {[['campanas','🚀 Campañas'],['leads','👥 Leads'],['asesores','🧑‍💼 Asesores']].map(([id,label])=>(
        <button key={id} onClick={()=>setTab(id)} style={{padding:'7px 14px',borderRadius:8,fontSize:13,cursor:'pointer',
          background:tab===id?P.purpleDim:'rgba(255,255,255,0.04)',color:tab===id?P.purple:P.muted,
          border:`1px solid ${tab===id?P.purpleBorder:P.border}`,fontWeight:tab===id?600:400}}>{label}</button>
      ))}
    </div>

    {loading?<div style={{textAlign:'center',padding:48,color:P.muted}}>Cargando...</div>:(<>

      {tab==='campanas'&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:14}}>
        {myCampaigns.length===0?<p style={{color:P.muted,fontSize:13}}>Sin campañas asignadas aún.</p>:
        myCampaigns.map(c=>{
          const campLeads=myLeads.filter(l=>l.team||true) // all for now
          const deposited=campLeads.filter(l=>l.deposit_confirmed).length
          return <div key={c.id} style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:12,padding:18}}>
            <div style={{fontWeight:700,color:P.text,marginBottom:6}}>{c.name}</div>
            <div style={{fontSize:12,color:P.muted,marginBottom:12}}>Estado: <span style={{color:P.green}}>{c.status}</span></div>
            <div style={{display:'flex',gap:8,fontSize:12}}>
              <div style={{flex:1,background:P.purpleDim,borderRadius:8,padding:'8px 10px',textAlign:'center'}}>
                <div style={{fontWeight:700,color:P.purple}}>{campLeads.length}</div>
                <div style={{color:P.muted}}>Leads</div>
              </div>
              <div style={{flex:1,background:P.greenDim,borderRadius:8,padding:'8px 10px',textAlign:'center'}}>
                <div style={{fontWeight:700,color:P.green}}>{deposited}</div>
                <div style={{color:P.muted}}>Depósitos</div>
              </div>
            </div>
          </div>
        })}
      </div>}

      {tab==='leads'&&<div style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:12,overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr style={{borderBottom:`1px solid ${P.border}`}}>
            {['Nombre','Email','Etapa','Asesor','Depósito'].map(h=><th key={h} style={{padding:'10px 16px',textAlign:'left',fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:600}}>{h}</th>)}
          </tr></thead>
          <tbody>
            {myLeads.slice(0,50).map((l,i)=><tr key={l.id} style={{borderBottom:i<myLeads.length-1?`1px solid ${P.border}`:'none'}}>
              <td style={{padding:'10px 16px',fontSize:13,color:P.text,fontWeight:600}}>{l.full_name||'—'}</td>
              <td style={{padding:'10px 16px',fontSize:12,color:P.muted,fontFamily:'monospace'}}>{l.email}</td>
              <td style={{padding:'10px 16px'}}><span style={{fontSize:11,padding:'3px 8px',borderRadius:5,background:(etapaColor[l.etapa]||P.muted)+'20',color:etapaColor[l.etapa]||P.muted,fontWeight:600}}>{etapaLabel[l.etapa]||'—'}</span></td>
              <td style={{padding:'10px 16px',fontSize:12,color:P.muted}}>{l.advisor_assigned||'—'}</td>
              <td style={{padding:'10px 16px'}}>{l.deposit_confirmed?<span style={{color:P.green,fontSize:12,fontWeight:700}}>✓ ${l.deposit_amount_usd||0}</span>:<span style={{color:P.muted,fontSize:12}}>—</span>}</td>
            </tr>)}
          </tbody>
        </table>
        {myLeads.length===0&&<p style={{textAlign:'center',padding:32,color:P.muted,fontSize:13}}>Sin leads asignados</p>}
      </div>}

      {tab==='asesores'&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:14}}>
        {assignments.filter(a=>a.advisor_user_id).length===0?<p style={{color:P.muted,fontSize:13}}>Sin asesores asignados aún.</p>:
        assignments.filter(a=>a.advisor_user_id).map(a=>{
          const advisorLeads=myLeads.filter(l=>l.advisor_assigned===a.advisor_user_id)
          const profile=a.crm_staff_profiles
          return <div key={a.id} style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:12,padding:18}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
              <div style={{width:34,height:34,borderRadius:8,background:P.purpleDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:P.purple}}>
                {(profile?.display_name||'?')[0].toUpperCase()}
              </div>
              <div>
                <div style={{fontWeight:700,color:P.text,fontSize:13}}>{profile?.display_name||'Asesor'}</div>
                <div style={{fontSize:11,color:P.muted,fontFamily:'monospace'}}>{profile?.pessaro_email||'—'}</div>
              </div>
            </div>
            <div style={{display:'flex',gap:8,fontSize:12}}>
              <div style={{flex:1,background:P.purpleDim,borderRadius:8,padding:'7px 10px',textAlign:'center'}}>
                <div style={{fontWeight:700,color:P.purple}}>{advisorLeads.length}</div>
                <div style={{color:P.muted,fontSize:11}}>Leads</div>
              </div>
              <div style={{flex:1,background:P.greenDim,borderRadius:8,padding:'7px 10px',textAlign:'center'}}>
                <div style={{fontWeight:700,color:P.green}}>{advisorLeads.filter(l=>l.deposit_confirmed).length}</div>
                <div style={{color:P.muted,fontSize:11}}>Depósitos</div>
              </div>
            </div>
          </div>
        })}
      </div>}
    </>)}
  </div>
}

export default function App(){
  const[user,setUser]          =useState(null)
  const[checking,setChecking]  =useState(true)
  const[isSuperAdmin,setSA]    =useState(false)
  const[isBroker,setIsBroker]  =useState(false)
  const[teamId,setTeamId]      =useState(null)
  const[tools,setTools]        =useState([])   // módulos habilitados para este usuario
  const[module,setModule]      =useState('dashboard')
  const[contacts,setContacts]  =useState([])
  const[leads,setLeads]        =useState([])
  const[staffProfile,setSP]    =useState(null)
  const[campaigns,setCampaigns]=useState([])
  const[loading,setLoading]    =useState(true)

  // ── Helpers de rol ────────────────────────────────────────────────────────
  // canAccess: true si el módulo está en tools[] o el usuario es super_admin
  const canAccess=(mod)=>isSuperAdmin||tools.includes(mod)

  // ── Auth + perfil RBAC ────────────────────────────────────────────────────
  useEffect(()=>{
    const loadProfile=async(u)=>{
      if(!u){setSA(false);setIsBroker(false);setTeamId(null);setTools([]);return}
      try{
        const{data}=await supabase.rpc('get_my_profile')
        const role=data?.role||'asesor'
        const tid=data?.team_id||null
        const t=data?.tools||[]
        setSA(role==='super_admin')
        setIsBroker(role==='broker')
        setTeamId(tid)
        setTools(t)
      }catch(e){
        console.warn('get_my_profile fallback:',e)
        const role=u?.user_metadata?.role||'asesor'
        setSA(role==='super_admin')
        setIsBroker(role==='broker')
        setTools(['dashboard','contacts','pipeline','emails','tasks'])
      }
    }
    supabase.auth.getSession().then(async({data:{session}})=>{
      const u=session?.user??null
      setUser(u)
      await loadProfile(u)
      setChecking(false)
    }).catch(()=>setChecking(false))
    const{data:{subscription}}=supabase.auth.onAuthStateChange(async(_,session)=>{
      const u=session?.user??null
      setUser(prev=>{
        if(prev?.id===u?.id) return prev
        return u
      })
      await loadProfile(u)
    })
    return()=>subscription.unsubscribe()
  },[])

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!user)return
    const load=async()=>{
      setLoading(true)
      try{
        const[r1,r2,r3,r4]=await Promise.all([
          supabase.from('contact_submissions').select('id,full_name,email,mobile,investment_capital,management_type,comments,form_type,status,submitted_at').order('submitted_at',{ascending:false}).limit(200),
          supabase.from('campaign_leads').select('id,full_name,email,phone,investment_range,etapa,advisor_assigned,advisor_contacted,account_created,kyc_verified,deposit_confirmed,score,team,created_at,variant,perfil').order('created_at',{ascending:false}),
          supabase.from('crm_staff_profiles').select('*').eq('user_id',user.id).maybeSingle(),
          supabase.from('campaigns').select('*').eq('status','activa').order('created_at'),
        ])
        setContacts(r1.data||[])
        setLeads(r2.data||[])
        setSP(r3.data||null)
        setCampaigns(r4.data||[])
      }catch(e){console.error('data load:',e)}
      finally{setLoading(false)}
    }
    load()
  },[user?.id])

  // ── CSS ───────────────────────────────────────────────────────────────────
  useEffect(()=>{
    const s=document.createElement('style')
    s.textContent=`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');*{box-sizing:border-box;margin:0;padding:0;}body{background:${P.bg};color:${P.text};font-family:'Inter',sans-serif;}input,select,textarea{font-family:'Inter',sans-serif!important;}::-webkit-scrollbar{width:4px;height:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px;}input::placeholder,textarea::placeholder{color:${P.muted}!important;}select option{background:${P.surface};}input:focus,select:focus,textarea:focus{border-color:rgba(108,92,231,0.5)!important;}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`
    document.head.appendChild(s)
    return()=>document.head.removeChild(s)
  },[])

  if(checking)return<div style={{minHeight:'100vh',background:P.bg,display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:28,height:28,border:`3px solid ${P.border}`,borderTop:`3px solid ${P.purple}`,borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/></div>
  if(!user)return<Login onLogin={setUser}/>

  const logout=async()=>{await supabase.auth.signOut();setUser(null);setSA(false);setIsBroker(false);setTeamId(null);setTools([])}

  // ── Modules ───────────────────────────────────────────────────────────────
  // campMods removed — lazy rendering via renderModule()

  const validMods=isBroker?['broker']:[
    'dashboard',
    ...(canAccess('contacts') ?['contacts']:[]),
    ...(canAccess('pipeline') ?['pipeline']:[]),
    ...(canAccess('tasks')    ?['tasks']:[]),
    ...(canAccess('emails')   ?['emails']:[]),
    ...(canAccess('reports')  ?['reports']:[]),
    ...(canAccess('equipo')   ?['equipo']:[]),
    ...(isSuperAdmin          ?['admin_campaigns']:[]),
    ...(canAccess('campaigns')?campaigns.map(c=>'camp_'+c.id):[]),
  ]

  // NAV filtrado por herramientas habilitadas (canAccess) — broker ve panel propio
  const NAV=isBroker?[]:[
    {id:'dashboard',label:'Dashboard',icon:'⊞'},
    canAccess('contacts') ?{id:'contacts', label:'Contactos', icon:'📋'}:null,
    canAccess('pipeline') ?{id:'pipeline', label:'Pipeline',  icon:'◈'}:null,
    ...(canAccess('campaigns')?campaigns.map(c=>({id:'camp_'+c.id,label:c.name,icon:'🚀',color:P.green})):[]),
    canAccess('tasks')    ?{id:'tasks',    label:'Tareas',    icon:'✓'}:null,
    canAccess('emails')   ?{id:'emails',   label:'Emails',    icon:'✉'}:null,
    canAccess('reports')  ?{id:'reports',  label:'Reportes',  icon:'▦'}:null,
    canAccess('equipo')   ?{id:'equipo',   label:'Equipo',    icon:'👥'}:null,
    ...(isSuperAdmin?[{id:'admin_campaigns',label:'Campañas admin',icon:'⚙',color:P.orange}]:[]),
  ].filter(Boolean)

  const currentMod=validMods.includes(module)?module:'dashboard'

  return <div style={{display:'flex',minHeight:'100vh',background:P.bg}}>
    {/* Sidebar */}
    <div style={{width:218,background:P.sidebar,borderRight:`1px solid ${P.border}`,display:'flex',flexDirection:'column',flexShrink:0,position:'sticky',top:0,height:'100vh'}}>
      <div style={{padding:'22px 18px',borderBottom:`1px solid ${P.border}`,display:'flex',alignItems:'center',gap:12}}>
        <img src={LOGO_URI} width={32} height={32} style={{borderRadius:6,objectFit:'cover',display:'block'}} alt="Pessaro"/>
        <div><div style={{fontSize:14,fontWeight:800,color:P.text,letterSpacing:'-0.01em'}}>Pessaro</div><div style={{fontSize:10,color:P.purple,letterSpacing:'0.10em',textTransform:'uppercase',fontWeight:600}}>Capital CRM</div></div>
      </div>
      <nav style={{padding:'10px 8px',flex:1,overflowY:'auto'}}>
        {NAV.map(item=>{
          const active=currentMod===item.id
          const ic=item.color||P.purple
          return <button key={item.id} onClick={()=>setModule(item.id)}
            style={{width:'100%',display:'flex',alignItems:'center',gap:9,padding:'9px 12px',borderRadius:8,marginBottom:2,cursor:'pointer',textAlign:'left',
              background:active?ic+'22':'transparent',color:active?ic:P.muted,
              border:active?`1px solid ${ic}35`:'1px solid transparent',
              fontSize:13,fontWeight:active?600:400,transition:'all 0.12s'}}>
            <span style={{fontSize:15,width:18,textAlign:'center',opacity:active?1:0.7}}>{item.icon}</span>
            <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.label}</span>
            {active&&<div style={{width:5,height:5,borderRadius:'50%',background:ic,flexShrink:0}}/>}
          </button>
        })}
      </nav>
      {/* Supabase status */}
      <div style={{padding:'8px 12px',borderBottom:`1px solid ${P.border}`}}>
        <div style={{display:'flex',alignItems:'center',gap:6,padding:'6px 10px',background:P.greenDim,border:`1px solid ${P.green}30`,borderRadius:7}}>
          <div style={{width:5,height:5,borderRadius:'50%',background:P.green,flexShrink:0}}/>
          <span style={{fontSize:10,color:P.green,fontWeight:600,letterSpacing:'0.04em'}}>Supabase conectado</span>
        </div>
      </div>
      {/* User card */}
      <div style={{padding:'12px 14px'}}>
        {/* Avatar + nombre + cargo */}
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
          <div style={{
            width:38,height:38,borderRadius:10,flexShrink:0,
            background:isSuperAdmin?P.orangeDim:isBroker?P.blueDim:P.purpleDim,
            display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:15,fontWeight:800,
            color:isSuperAdmin?P.orange:isBroker?P.blue:P.purple,
            border:`1.5px solid ${isSuperAdmin?P.orange:isBroker?P.blue:P.purple}30`
          }}>
            {(staffProfile?.display_name||user?.email||'?')[0].toUpperCase()}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:700,color:P.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
              {staffProfile?.display_name||user?.email?.split('@')[0]||'Usuario'}
            </div>
            <div style={{fontSize:10,color:P.muted,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',marginTop:1}}>
              {staffProfile?.title||'Pessaro Capital'}
            </div>
          </div>
        </div>
        {/* Email institucional */}
        {staffProfile?.pessaro_email&&<div style={{
          display:'flex',alignItems:'center',gap:6,padding:'5px 8px',marginBottom:8,
          background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:6}}>
          <span style={{fontSize:10}}>✉</span>
          <span style={{fontSize:10,color:P.blue,fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            {staffProfile.pessaro_email}
          </span>
        </div>}
        {/* Role badge */}
        <div style={{marginBottom:10}}>
          {isSuperAdmin&&<div style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',background:P.orangeDim,border:`1px solid ${P.orange}30`,borderRadius:5}}>
            <span style={{fontSize:9}}>⚙</span><span style={{fontSize:10,color:P.orange,fontWeight:700,letterSpacing:'0.04em'}}>Super Admin</span>
          </div>}
          {isBroker&&!isSuperAdmin&&<div style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',background:P.blueDim,border:`1px solid ${P.blue}30`,borderRadius:5}}>
            <span style={{fontSize:9}}>⬡</span><span style={{fontSize:10,color:P.blue,fontWeight:700,letterSpacing:'0.04em'}}>Administrador</span>
          </div>}
          {!isSuperAdmin&&!isBroker&&<div style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',background:P.purpleDim,border:`1px solid ${P.purpleBorder}`,borderRadius:5}}>
            <span style={{fontSize:9}}>◈</span><span style={{fontSize:10,color:P.purple,fontWeight:700,letterSpacing:'0.04em'}}>Asesor</span>
          </div>}
        </div>
        {/* Logout */}
        <button onClick={logout} style={{width:'100%',padding:'6px 0',fontSize:11,color:P.muted,background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:6,cursor:'pointer',transition:'all 0.12s'}}
          onMouseEnter={e=>{e.currentTarget.style.color=P.red;e.currentTarget.style.borderColor=P.red+'40'}}
          onMouseLeave={e=>{e.currentTarget.style.color=P.muted;e.currentTarget.style.borderColor=P.border}}>
          Cerrar sesión →
        </button>
      </div>
    </div>
    {/* Main */}
    <div style={{flex:1,padding:'28px 32px',overflowY:'auto',minHeight:'100vh'}}>
      <ErrorBoundary key={currentMod}>{(()=>{
        if(loading&&currentMod==='dashboard') return <Spinner/>
        if(isBroker) return <BrokerView user={user} campaigns={campaigns} leads={leads} isSuperAdmin={isSuperAdmin}/>
        if(currentMod==='dashboard') return <Dashboard contacts={contacts} leads={leads} onNav={setModule}/>
        if(currentMod==='contacts')  return <Contacts user={user} isSuperAdmin={isSuperAdmin}/>
        if(currentMod==='pipeline')  return <Pipeline leads={leads} setLeads={setLeads} isSuperAdmin={isSuperAdmin}/>
        if(currentMod==='tasks')     return <Tasks contacts={contacts} leads={leads}/>
        if(currentMod==='emails')    return <Emails contacts={contacts} leads={leads} staffProfile={staffProfile} user={user} isSuperAdmin={isSuperAdmin}/>
        if(currentMod==='reports')   return <Reports contacts={contacts} leads={leads}/>
        if(currentMod==='equipo')    return <Equipo user={user} isSuperAdmin={isSuperAdmin} teamId={teamId}/>
        if(currentMod==='admin_campaigns'&&isSuperAdmin) return <AdminCampaigns campaigns={campaigns} setCampaigns={setCampaigns} user={user}/>
        const camp=campaigns.find(c=>'camp_'+c.id===currentMod)
        if(camp) return <CampanaModule key={camp.id} campaign={camp} user={user} isSuperAdmin={isSuperAdmin} globalLeads={leads} setGlobalLeads={setLeads}/>
        return <Dashboard contacts={contacts} leads={leads} onNav={setModule}/>
      })()}</ErrorBoundary>
    </div>
  </div>
}
