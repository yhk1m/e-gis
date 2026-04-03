(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const t of document.querySelectorAll('link[rel="modulepreload"]'))o(t);new MutationObserver(t=>{for(const n of t)if(n.type==="childList")for(const r of n.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&o(r)}).observe(document,{childList:!0,subtree:!0});function s(t){const n={};return t.integrity&&(n.integrity=t.integrity),t.referrerPolicy&&(n.referrerPolicy=t.referrerPolicy),t.crossOrigin==="use-credentials"?n.credentials="include":t.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function o(t){if(t.ep)return;t.ep=!0;const n=s(t);fetch(t.href,n)}})();const c="1.1.0",i={title:"개인정보 처리방침",lastUpdated:"2026년 3월 17일",effectiveDate:"2026년 2월 7일",intro:'e-GIS(이하 "서비스")는 「개인정보 보호법」 제30조에 따라 정보주체의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이 개인정보 처리방침을 수립·공개합니다.',sections:[{title:"제1조 개인정보의 처리목적",content:`① 서비스는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하는 개인정보는 다음 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 「개인정보 보호법」 제18조에 따라 별도의 동의를 받습니다.

<strong>회원 가입 및 관리</strong>
회원 가입의사 확인, 회원제 서비스 제공에 따른 본인 식별·인증, 회원자격 유지·관리, 만 14세 미만 아동의 개인정보 처리 시 법정대리인의 동의여부 확인, 서비스 부정이용 방지, 각종 고지·통지 등을 목적으로 개인정보를 처리합니다.

<strong>서비스 제공</strong>
GIS 프로젝트 클라우드 저장 및 불러오기, 사용자 맞춤 서비스 제공 등을 목적으로 개인정보를 처리합니다.

<strong>서비스 개선에 활용</strong>
학교별 이용 통계 분석, 서비스 품질 향상, 신규 서비스 개발을 위한 자료 등의 목적으로 개인정보를 처리합니다.`},{title:"제2조 처리하는 개인정보 항목",content:`① 서비스는 「개인정보 보호법」에 따라 서비스 제공을 위해 필요 최소한의 범위에서 다음의 개인정보 항목을 수집·이용합니다.

<strong>[ 정보주체의 동의를 받아 처리하는 개인정보 항목 ]</strong>

<strong>1. 필수 항목</strong>
• 이메일 주소: 회원 식별 및 로그인

<strong>2. 선택 항목</strong>
• 이름, 닉네임: 프로필 표시
• 소속 학교, 지역: 학교별 통계 집계

<strong>3. 로컬 저장 항목 (이용자 기기 내 저장, 서버 미전송)</strong>
• GIS 프로젝트 데이터, 레이어 정보, 설정값
• 해당 정보는 이용자 브라우저의 IndexedDB 및 LocalStorage에 저장되며, 서버로 전송되지 않습니다.

② 이용자는 서비스 이용을 위한 개인정보 수집에 대하여 거부할 수 있습니다. 다만, 필수항목은 서비스 이용에 필요한 최소한의 정보이므로 이에 대한 수집 거부 시 회원가입이 제한됩니다.`},{title:"제3조 개인정보의 처리 및 보유기간",content:`① 서비스는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보 수집 시에 동의받은 보유·이용기간 내에서 개인정보를 처리·보유합니다.

② 각각의 개인정보 처리 및 보유 기간은 다음과 같습니다.

<strong>회원 정보 (이메일, 프로필)</strong>
• 회원 탈퇴 시까지

<strong>프로젝트 데이터 (클라우드 저장)</strong>
• 회원 탈퇴 시까지

<strong>로컬 저장 데이터</strong>
• 브라우저 데이터 삭제 시까지

다만, 다음의 사유에 해당하는 경우에는 해당 사유 종료 시까지
• 관계 법령 위반에 따른 수사·조사 등이 진행 중인 경우에는 해당 수사·조사 종료 시까지

③ 서비스는 이용자의 개인정보를 개인정보 처리목적에서 고지한 범위 내에서 사용하며, 이용자의 사전 동의 없이는 고지한 범위를 초과하여 이용하거나 이용자의 개인정보를 외부에 공개하지 않습니다. 다만 아래의 경우에는 예외로 합니다.
• 이용자가 사전에 동의한 경우
• 법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우`},{title:"제4조 개인정보의 파기 절차 및 방법",content:`① 서비스는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체 없이 해당 개인정보를 파기합니다.

② 정보주체로부터 동의받은 개인정보 보유기간이 경과하거나 처리목적이 달성되었음에도 불구하고 다른 법령에 따라 개인정보를 계속 보존하여야 하는 경우에는, 해당 개인정보를 별도의 데이터베이스(DB)로 옮기거나 보관장소를 달리하여 보존합니다.

③ 개인정보 파기의 절차 및 방법은 다음과 같습니다.

<strong>파기 절차</strong>
서비스는 파기 사유가 발생한 개인정보를 선정하고, 개인정보 보호책임자의 승인을 거쳐 개인정보를 파기합니다.

<strong>파기 방법</strong>
• 클라우드 데이터: Supabase 데이터베이스에서 기록을 재생할 수 없도록 영구 삭제
• 로컬 데이터: 브라우저 저장소(IndexedDB, LocalStorage) 초기화를 통한 삭제`},{title:"제5조 만 14세 미만 아동의 개인정보 보호",content:`① 서비스는 만 14세 미만 아동의 개인정보를 처리하기 위하여 동의가 필요한 경우에는 해당 아동의 법정대리인으로부터 동의를 받습니다.

② 서비스는 만 14세 미만 아동의 개인정보 처리에 관하여 법정대리인의 동의를 받을 때에는 학기 초 학교 가정통신문(개인정보 수집·이용 동의서)을 통해 법정대리인의 동의를 받습니다. 교사는 학생들의 서비스 이용 전 법정대리인 동의를 받을 책임이 있습니다.

③ 법정대리인은 만 14세 미만 아동의 개인정보에 대하여 열람, 정정·삭제, 처리정지 요구 등의 권리를 아동을 대신하여 행사할 수 있습니다.`},{title:"제6조 개인정보의 제3자 제공",content:"① 서비스는 정보주체의 개인정보를 개인정보의 처리 목적에서 명시한 범위 내에서만 처리하며, 정보주체의 동의, 법률의 특별한 규정 등 「개인정보 보호법」 제17조 및 제18조에 해당하는 경우에만 개인정보를 제3자에게 제공하고 그 이외에는 정보주체의 개인정보를 제3자에게 제공하지 않습니다."},{title:"제7조 개인정보처리의 위탁",content:`① 서비스는 원활한 개인정보 업무처리를 위하여 다음과 같이 개인정보 처리업무를 위탁하고 있습니다.

<strong>위탁받는 자(수탁자)</strong>: Supabase, Inc.
<strong>위탁하는 업무 내용</strong>: 사용자 인증 및 클라우드 데이터베이스 운영·관리
<strong>이전 국가</strong>: 미국 (서버 소재지)
<strong>이전 시기 및 방법</strong>: 서비스 이용 시점에 네트워크를 통한 전송
<strong>개인정보 보유 및 이용기간</strong>: 회원 탈퇴 시 또는 위탁계약 종료 시까지

② 서비스는 위탁계약 체결 시 「개인정보 보호법」 제26조에 따라 위탁업무 수행목적 외 개인정보 처리금지, 안전성 확보조치, 기술적·관리적 보호조치, 수탁자에 대한 관리·감독, 손해배상 등 책임에 관한 사항을 명시하고, 수탁자가 개인정보를 안전하게 처리하는지를 감독하고 있습니다.

③ 위탁업무의 내용이나 수탁자가 변경될 경우에는 지체 없이 본 개인정보 처리방침을 통하여 공개하도록 하겠습니다.

④ 이용자는 회원 탈퇴를 통해 국외 이전을 거부할 수 있으며, 이 경우 클라우드 저장 서비스 이용이 제한됩니다.`},{title:"제8조 개인정보 자동 수집 장치의 운영 및 거부",content:`① 서비스는 이용자의 편의를 위해 브라우저 로컬 저장소(LocalStorage, IndexedDB)를 사용하여 설정값과 프로젝트 데이터를 저장합니다.

② 해당 데이터는 이용자의 기기에만 저장되며 서버로 전송되지 않습니다. 이용자는 브라우저 설정을 통해 저장된 데이터를 삭제할 수 있습니다.

③ 서비스는 별도의 쿠키(cookie)를 사용하지 않습니다. 다만, 인증 서비스 제공을 위해 Supabase에서 인증 토큰을 로컬 저장소에 저장할 수 있습니다.

▶ 브라우저에서 로컬 저장소 데이터 삭제
• 크롬(Chrome): 웹 브라우저 설정 > 개인정보 보호 및 보안 > 인터넷 사용 기록 삭제
• 엣지(Edge): 웹 브라우저 설정 > 쿠키 및 사이트 권한 > 쿠키 및 사이트 데이터 관리 및 삭제
• 웨일(Whale): 웹 브라우저 설정 > 개인정보 보호 > 인터넷 사용 기록 삭제`},{title:"제9조 정보주체와 법정대리인의 권리·의무 및 행사방법",content:`① 정보주체는 서비스에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다.
• 개인정보의 처리에 관한 정보를 받을 권리
• 개인정보의 처리에 관한 동의 여부, 동의 범위 등을 선택하고 결정할 권리
• 개인정보 처리 여부를 확인하고 개인정보에 대하여 열람(사본 발급 포함)을 요구할 권리
• 개인정보의 처리 정지, 정정·삭제 및 파기를 요구할 권리

② 권리 행사는 서비스에 대해 서면, 전자우편 등을 통하여 하실 수 있으며 서비스는 이에 대해 지체 없이 조치하겠습니다.

③ 정보주체가 개인정보의 오류 등에 대한 정정 또는 삭제를 요구한 경우에는 서비스는 정정 또는 삭제를 완료할 때까지 당해 개인정보를 이용하거나 제공하지 않습니다.

④ 권리 행사는 정보주체의 법정대리인이나 위임을 받은 자 등 대리인을 통하여 하실 수 있습니다.

⑤ 개인정보 열람 및 처리정지 요구는 「개인정보 보호법」 제35조 제4항, 제37조 제2항에 의하여 정보주체의 권리가 제한될 수 있습니다.

⑥ 개인정보의 정정 및 삭제 요구는 다른 법령에서 그 개인정보가 수집 대상으로 명시되어 있는 경우에는 삭제를 요구할 수 없습니다.

<strong>권리 행사 방법</strong>
• 마이페이지 > 개인정보 관리에서 직접 열람·수정 가능
• 회원탈퇴 기능을 통해 즉시 삭제 가능
• 이메일(fkv777@gmail.com)로 요청 시 지체 없이 조치`},{title:"제10조 개인정보의 안전성 확보 조치",content:`① 서비스는 「개인정보 보호법」 제29조에 따라 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.

<strong>관리적 조치</strong>
• 개인정보 취급 직원의 최소화
• 정기적인 자체 점검 실시

<strong>기술적 조치</strong>
• 비밀번호 암호화: 이용자의 비밀번호는 암호화되어 저장
• 전송 구간 암호화: 전 구간 HTTPS 암호화 통신 적용
• 접근 권한 관리: 데이터베이스 접근 권한 최소화
• 보안 프로그램 설치 및 갱신`},{title:"제11조 개인정보 보호 책임자 안내",content:`① 서비스는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.

<strong>개인정보 보호책임자</strong>
• 성명: 김용현
• 직위: 개발자
• 이메일: bgnlkim@gmail.com

② 정보주체는 서비스를 이용하면서 발생한 모든 개인정보 보호 관련 문의, 불만처리, 피해구제 등에 관한 사항을 개인정보 보호책임자에게 문의하실 수 있습니다. 서비스는 정보주체의 문의에 대해 지체 없이 답변 및 처리해 드릴 것입니다.`},{title:"제12조 개인정보 처리방침의 변경",content:`① 이 개인정보 처리방침은 2026년 2월 7일부터 적용됩니다.

② 이 개인정보 처리방침은 법령, 정책 또는 보안기술의 변경에 따라 내용이 추가, 삭제 및 수정될 수 있습니다. 변경 시에는 변경사항 시행 7일 전부터 서비스 내 공지사항을 통해 고지할 것입니다.

③ 본 방침은 최초로 수립·공개되는 개인정보 처리방침이므로, 이전의 개인정보 처리방침 이력은 존재하지 않습니다.`},{title:"제13조 권익침해 구제방법",content:`① 정보주체는 개인정보침해로 인한 구제를 받기 위하여 개인정보분쟁조정위원회, 한국인터넷진흥원 개인정보침해신고센터 등에 분쟁해결이나 상담 등을 신청할 수 있습니다. 이 밖에 기타 개인정보침해의 신고, 상담에 대하여는 아래의 기관에 문의하시기 바랍니다.

• <strong>개인정보분쟁조정위원회</strong>: (국번없이) 1833-6972 (www.kopico.go.kr)
• <strong>개인정보침해신고센터</strong>: (국번없이) 118 (privacy.kisa.or.kr)
• <strong>대검찰청</strong>: (국번없이) 1301 (www.spo.go.kr)
• <strong>경찰청</strong>: (국번없이) 182 (ecrm.cyber.go.kr)

② 「개인정보 보호법」 제35조(개인정보의 열람), 제36조(개인정보의 정정·삭제), 제37조(개인정보의 처리정지 등)의 규정에 의한 요구에 대하여 공공기관의 장이 행한 처분 또는 부작위로 인하여 권리 또는 이익의 침해를 받은 자는 행정심판법이 정하는 바에 따라 행정심판을 청구할 수 있습니다.
※ 행정심판에 대해 자세한 사항은 중앙행정심판위원회(www.simpan.go.kr) 홈페이지를 참고하시기 바랍니다.`},{title:"제14조 개인정보 열람청구",content:`① 정보주체는 「개인정보 보호법」 제35조에 따른 개인정보의 열람 청구를 아래의 담당자에게 할 수 있습니다. 서비스는 정보주체의 개인정보 열람청구가 신속하게 처리되도록 노력하겠습니다.

▶ 개인정보 열람청구 접수·처리 담당자
• 성명: 김용현
• 직위: 개발자
• 연락처: bgnlkim@gmail.com`}]};class l{constructor(){this.modal=null}show(){this.render()}render(){this.close(),this.modal=document.createElement("div"),this.modal.className="modal-overlay privacy-modal active",this.modal.innerHTML=`
      <div class="modal-content privacy-content">
        <div class="modal-header">
          <h3>${i.title}</h3>
          <button class="modal-close" id="privacy-close">&times;</button>
        </div>
        <div class="modal-body privacy-body">
          <div class="privacy-meta">
            <span>버전: ${c}</span>
            <span>최종 수정: ${i.lastUpdated}</span>
          </div>
          <div class="privacy-intro">${i.intro}</div>
          <div class="privacy-sections">
            ${i.sections.map(e=>`
              <div class="privacy-section">
                <h4>${e.title}</h4>
                <div class="privacy-section-content">${e.content.replace(/\n/g,"<br>")}</div>
              </div>
            `).join("")}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="privacy-download-pdf">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            PDF 다운로드
          </button>
          <button class="btn btn-primary" id="privacy-confirm">확인</button>
        </div>
      </div>
    `,document.body.appendChild(this.modal),this.bindEvents()}getSummaryHTML(){return`
      <div class="privacy-summary">
        <div class="privacy-summary-title">개인정보 수집·이용 동의 (필수)</div>
        <div class="privacy-summary-content">
          <div class="privacy-summary-item">
            <span class="privacy-label">수집 항목</span>
            <span class="privacy-value">이메일 주소</span>
          </div>
          <div class="privacy-summary-item">
            <span class="privacy-label">수집 목적</span>
            <span class="privacy-value">회원 식별, 클라우드 저장 서비스 제공</span>
          </div>
          <div class="privacy-summary-item">
            <span class="privacy-label">보유 기간</span>
            <span class="privacy-value">회원 탈퇴 시까지</span>
          </div>
        </div>
        <button type="button" class="btn btn-outline privacy-full-btn" id="show-full-privacy">
          전문 보기
        </button>
      </div>
    `}bindEvents(){const e=document.getElementById("privacy-close"),s=document.getElementById("privacy-confirm"),o=document.getElementById("privacy-download-pdf");e&&e.addEventListener("click",()=>this.close()),s&&s.addEventListener("click",()=>this.close()),o&&o.addEventListener("click",()=>this.downloadPDF()),this.modal.addEventListener("click",t=>{t.target===this.modal&&this.close()})}downloadPDF(){const e=document.createElement("a");e.href="/privacy-policy.pdf",e.download="개인정보 처리방침(e-GIS).pdf",e.click()}close(){this.modal&&(this.modal.remove(),this.modal=null)}}const d=new l;export{c as P,i as a,d as p};
//# sourceMappingURL=PrivacyPolicyPanel-B1luajin.js.map
