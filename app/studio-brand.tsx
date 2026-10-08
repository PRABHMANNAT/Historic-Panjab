export const studioName = 'Prabh Map Studio';
export const studioRepository = 'https://github.com/PRABHMANNAT/Historic-Panjab';

export function StudioMark({className}:{className?:string}) {
  return <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
    <rect width="64" height="64" rx="17" fill="#183d35"/>
    <path d="M13 23 25 18 39 24 51 19V45L39 50 25 44 13 49Z" fill="#dcebc7" fillOpacity=".1" stroke="#e5efdc" strokeWidth="2.5" strokeLinejoin="round"/>
    <path d="M25 18V44M39 24V50" stroke="#e5efdc" strokeWidth="2" strokeOpacity=".45"/>
    <path d="M45 12 23 35 34 33 33 44Z" fill="#e6bd72" stroke="#183d35" strokeWidth="2" strokeLinejoin="round"/>
  </svg>;
}

export function StudioAbout() {
  return <section className="studio-about" aria-labelledby="studio-about-title">
    <div className="studio-about-heading"><StudioMark/><div><span className="studio-about-kicker">OPEN SOURCE · SOUTH ASIA</span><h2 id="studio-about-title">{studioName}</h2></div></div>
    <p className="studio-about-intro">A map studio for research, learning, and exploring South Asia.</p>
    <div className="studio-creator"><span>DEVELOPED & CREATED BY</span><strong>Prabhmannat Singh <small>Prabh</small></strong><p>Explore administrative boundaries, build regional comparisons, and create maps for your research.</p></div>
    <div className="studio-about-links"><a href={studioRepository} target="_blank" rel="noreferrer">Source code on GitHub ↗</a><a href={studioRepository+'/blob/main/LICENSE'} target="_blank" rel="noreferrer">MIT software license ↗</a></div>
    <p className="studio-about-note">Application code and original branding are open source under MIT. Map data, photographs, fonts, and dependencies retain their own licenses and credits. Research context, source dates, and geographic qualifications are documented below.</p>
  </section>;
}
