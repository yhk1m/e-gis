/**
 * AppLayout - 전체 앱 레이아웃 구조 생성
 */

import { logoMarkSvg } from './logoMark.js';

// SVG를 Base64 데이터 URI로 인코딩하여 파일 서빙 문제 해결
const faviconSvg = `data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyBpZD0iX+ugiOydtOyWtF8yIiBkYXRhLW5hbWU9IuugiOydtOyWtCAyIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1OTIgNTkyIj4KICA8ZGVmcz4KICAgIDxzdHlsZT4KICAgICAgLmNscy0xLCAuY2xzLTIgewogICAgICAgIGZpbGw6ICNlNjAwMTI7CiAgICAgIH0KCiAgICAgIC5jbHMtMywgLmNscy00IHsKICAgICAgICBmaWxsOiAjZmZmOwogICAgICB9CgogICAgICAuY2xzLTUgewogICAgICAgIGZpbGw6ICM0Y2FmNTA7CiAgICAgIH0KCiAgICAgIC5jbHMtNSwgLmNscy02LCAuY2xzLTIsIC5jbHMtNCwgLmNscy03IHsKICAgICAgICBzdHJva2UtbWl0ZXJsaW1pdDogMTA7CiAgICAgIH0KCiAgICAgIC5jbHMtNSwgLmNscy0yLCAuY2xzLTQsIC5jbHMtNyB7CiAgICAgICAgc3Ryb2tlOiAjZmZmOwogICAgICAgIHN0cm9rZS13aWR0aDogODBweDsKICAgICAgfQoKICAgICAgLmNscy02IHsKICAgICAgICBzdHJva2U6ICM4NDg3ODQ7CiAgICAgICAgc3Ryb2tlLXdpZHRoOiA1cHg7CiAgICAgIH0KCiAgICAgIC5jbHMtNiwgLmNscy03IHsKICAgICAgICBmaWxsOiBub25lOwogICAgICAgIHN0cm9rZS1saW5lY2FwOiByb3VuZDsKICAgICAgfQoKICAgICAgLmNscy04IHsKICAgICAgICBmaWxsOiAjMDZjOwogICAgICB9CiAgICA8L3N0eWxlPgogIDwvZGVmcz4KICA8ZyBpZD0iX+ugiOydtOyWtF8xLTIiIGRhdGEtbmFtZT0i66CI7J207Ja0IDEiPgogICAgPGc+CiAgICAgIDxwYXRoIGNsYXNzPSJjbHMtNSIgZD0iTTU1MiwyOTZjMCwxNDEuMzgtMTE0LjYyLDI1Ni0yNTYsMjU2UzQwLDQzNy4zOSw0MCwyOTYsMTU0LjYyLDQwLDI5Niw0MGM0LjM1LDAsMTAuMTYtLjAzLDE3LjM5LjU4LDk5LjU2LDguNDEsMjM4LjYxLDEwMy4wMSwyMzguNjEsMjU1LjQyWiIvPgogICAgICA8cGF0aCBjbGFzcz0iY2xzLTciIGQ9Ik03OS40MSwxNjQuODZjMTMuNzIsMzAuNjMsNTEuOTgsMTAzLjUsMTMzLjIsMTUxLjksMTQ3LjMzLDg3LjgsMzExLjYxLDMxLjMyLDMyOS44NSwyNC43MyIvPgogICAgICA8cGF0aCBjbGFzcz0iY2xzLTciIGQ9Ik0xODUuMDYsNjYuNjNjMTEuMywyOS45NCw0Mi43NywxMDEuNTcsMTA0Ljk0LDE0Ni4wMywxMTIuNzgsODAuNjUsMjMzLjAzLDE2LjM5LDI0Ni4zNyw4LjkzIi8+CiAgICAgIDxwYXRoIGNsYXNzPSJjbHMtNyIgZD0iTTQyLjM0LDMwMy4yNmMxNC4wOCwzMi4yOCw1NC41NiwxMDcuNDUsMTMyLDE1NS4zOSwxNDAuNDgsODYuOTcsMjkwLjI2LDE3LjY3LDMwNi44OCw5LjYzIi8+CiAgICAgIDxwYXRoIGNsYXNzPSJjbHMtNyIgZD0iTTMxNS43OCw0Ni4xOGMtMjUuODQsNy41My0xMjQuMzIsMzkuNC0xODguMDksMTM3LjMzLTc0LjQyLDExNC4yOC00Mi42OCwyNDAuMjctMzcuMTYsMjYwLjYyIi8+CiAgICAgIDxwYXRoIGNsYXNzPSJjbHMtNyIgZD0iTTMyNi41MSw0Ni4xOGMxOS43NCwzMC45NCw4My40MSwxMzkuMDEsNjguOTMsMjg2LjAxLTEwLjU5LDEwNy41Mi01OS42NCwxODMuNzctODMuMTEsMjE2LjM1Ii8+CiAgICAgIDxwYXRoIGNsYXNzPSJjbHMtNyIgZD0iTTMyNi41MSw0Ni4xOGM4LjA4LDMuNjgsMTcxLjY4LDgxLjQyLDE4Mi4yLDI0My42NSw5LjIxLDE0MS45NC0xMDYuNDIsMjMwLjYzLTExOS42MywyNDAuNDIiLz4KICAgICAgPHBhdGggY2xhc3M9ImNscy03IiBkPSJNMzIwLjM3LDQ0LjM5Yy0yOS4yMSwyMy41NS04Mi4zNyw3OC45Ny0xMTcuOTQsMTQ1Ljc5LTQ2LjM2LDg3LjA4LTUwLjI3LDE2Ni42Ny01MC41NSwxOTYuMDgtLjQ3LDQ5LjAzLDEzLjkyLDEwNC4yMywyMS40NSwxMzEuMzkiLz4KICAgICAgPHBhdGggY2xhc3M9ImNscy03IiBkPSJNMzIxLjkxLDQ0LjY0Yy02LjAyLDgxLjE5LTE4LjA2LDE5My4wMy0zNS4yMywyODcuOTktMTMuMzEsNzMuNTYtMzAuNTgsMTQ4LjIzLTQ3LjQ5LDIxMS40Ii8+CiAgICAgIDxwYXRoIGNsYXNzPSJjbHMtNCIgZD0iTTMwOC41MywzMjMuNDhjLTIzLjE0LDAtNDMuNzEtMS4xMS02MS43LTMuMzctMTgtMi4yNC0zMy4xMS01LjYyLTQ1LjMxLTEwLjEyLDAsMTUuNDIsMi4yNCwyOS40LDYuNzUsNDEuOTQsNC40OSwxMi41MywxMS41NywyMi45OSwyMS4yMSwzMS4zMyw5LjY0LDkuNjQsMjAuNTYsMTYuMzksMzIuNzgsMjAuMjQsMTIuMiwzLjg2LDI2LjAzLDUuNzgsNDEuNDUsNS43OCwxMC45MiwwLDIzLjI5LS44LDM3LjEyLTIuNDEsMTMuODEtMS42LDI4Ljc2LTQuOTcsNDQuODMtMTAuMTIsOC45OS0yLjU2LDE2LjIyLTIuNTYsMjEuNjksMCw1LjQ1LDIuNTgsOS40Nyw3LjQsMTIuMDUsMTQuNDYsMS45Myw5LjAxLjYzLDE2LjM5LTMuODYsMjIuMTctNC41LDUuNzgtMTEuNTcsMTAuMjktMjEuMjEsMTMuNS0xMy41LDUuMTUtMjcuODEsOC42OC00Mi45LDEwLjYtMTUuMTEsMS45My0zMS4wMSwyLjg5LTQ3LjcyLDIuODktMjUuMDYsMC00Ny4yNC0zLjM3LTY2LjUyLTEwLjEycy0zNS4zNS0xNy41LTQ4LjItMzIuMjljLTE0LjE0LTEzLjUtMjQuNTgtMjkuNzItMzEuMzMtNDguNjgtNi43NS0xOC45NS0xMC4xMi00MC4wMS0xMC4xMi02My4xNCwwLTI1LjA2LDMuNjktNDguMDQsMTEuMDktNjguOTMsNy4zOC0yMC44OCwxOC44LTM5LjY4LDM0LjIyLTU2LjQsMTQuMTMtMTUuNDIsMzIuMjktMjcuNDgsNTQuNDctMzYuMTUsMjIuMTctOC42OCw0OC4wNC0xMy4wMSw3Ny42LTEzLjAxLDE3LjM1LDAsMzMuMDksMi43NCw0Ny4yNCw4LjE5LDE0LjEzLDUuNDcsMjYuOTksMTIuMzgsMzguNTYsMjAuNzMsMTAuMjcsOS42NCwxOC40NywyMC4wOSwyNC41OCwzMS4zMyw2LjEsMTEuMjUsOS4xNiwyMi45OSw5LjE2LDM1LjE5LDAsMTYuMDctMy4wNiwzMC4wNS05LjE2LDQxLjk0LTYuMTIsMTEuOS0xNC45NCwyMS42OS0yNi41MSwyOS40LTExLjU3LDguMzYtMjUuNzEsMTQuNjMtNDIuNDIsMTguOC0xNi43Miw0LjE5LTM2LDYuMjctNTcuODQsNi4yN1pNMjA4LjI3LDI1OC44OWMxMi44NSw1LjE1LDI4LjQ0LDguODQsNDYuNzYsMTEuMDksMTguMzIsMi4yNiwzOC43MSwzLjM3LDYxLjIyLDMuMzcsMTEuNTcsMCwyMS44NC0uNjMsMzAuODUtMS45Myw4Ljk5LTEuMjgsMTcuMDItMy44NiwyNC4xLTcuNzEsNi40Mi0yLjU2LDExLjI0LTYuOSwxNC40Ni0xMy4wMSwzLjIxLTYuMSw0LjgyLTEzLjk4LDQuODItMjMuNjIsMC00LjQ5LTEuMy05LjMxLTMuODYtMTQuNDYtMi41OC01LjE0LTYuMTItMTAuMjctMTAuNi0xNS40Mi01Ljc4LTQuNDktMTIuODYtOC4wMy0yMS4yMS0xMC42LTguMzYtMi41Ni0xOC4zMi0zLjg2LTI5Ljg5LTMuODYtMjAuNTgsMC0zOC40MSwyLjg5LTUzLjUsOC42OC0xNS4xMSw1Ljc4LTI3LjgxLDE0LjE0LTM4LjA4LDI1LjA2LTUuNzgsNi40My0xMC45NCwxMy4xOC0xNS40MiwyMC4yNC00LjUsNy4wOC03LjcxLDE0LjQ2LTkuNjQsMjIuMTdaIi8+CiAgICAgIDxnPgogICAgICAgIDxwYXRoIGNsYXNzPSJjbHMtMiIgZD0iTTU1MiwxMTVjMC00MS40Mi0zMy41OC03NS03NS03NS0uMDMsMC0uMDUsMC0uMDgsMC0uMDMsMC0uMDUsMC0uMDgsMC00MS40MiwwLTc1LDMzLjU4LTc1LDc1czYwLjI5LDE3MS40Niw3NSwyMDEuMDhjLjAyLjA0LjA0LjA4LjA2LjEydi4wNnMuMDEtLjAyLjAyLS4wM2MwLC4wMS4wMS4wMi4wMi4wM3YtLjA2cy4wNC0uMDguMDYtLjEyYzE0LjcxLTI5LjYyLDc1LTE1OS42NSw3NS0yMDEuMDhaIi8+CiAgICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTQiIGN4PSI0NzYuOTIiIGN5PSIxMTQuNDIiIHI9IjQ0LjUiLz4KICAgICAgPC9nPgogICAgICA8cGF0aCBjbGFzcz0iY2xzLTgiIGQ9Ik01NTIsMjk2YzAsMTQxLjM4LTExNC42MiwyNTYtMjU2LDI1NlM0MCw0MzcuMzksNDAsMjk2LDE1NC42Miw0MCwyOTYsNDBjNC4zNSwwLDEwLjE2LS4wMywxNy4zOS41OCw5OS41Niw4LjQxLDIzOC42MSwxMDMuMDEsMjM4LjYxLDI1NS40MloiLz4KICAgICAgPHBhdGggY2xhc3M9ImNscy02IiBkPSJNNzkuNDEsMTY0Ljg2YzEzLjcyLDMwLjYzLDUxLjk4LDEwMy41LDEzMy4yLDE1MS45LDE0Ny4zMyw4Ny44LDMxMS42MSwzMS4zMiwzMjkuODUsMjQuNzMiLz4KICAgICAgPHBhdGggY2xhc3M9ImNscy02IiBkPSJNMTg1LjA2LDY2LjYzYzExLjMsMjkuOTQsNDIuNzcsMTAxLjU3LDEwNC45NCwxNDYuMDMsMTEyLjc4LDgwLjY1LDIzMy4wMywxNi4zOSwyNDYuMzcsOC45MyIvPgogICAgICA8cGF0aCBjbGFzcz0iY2xzLTYiIGQ9Ik00Mi4zNCwzMDMuMjZjMTQuMDgsMzIuMjgsNTQuNTYsMTA3LjQ1LDEzMiwxNTUuMzksMTQwLjQ4LDg2Ljk3LDI5MC4yNiwxNy42NywzMDYuODgsOS42MyIvPgogICAgICA8cGF0aCBjbGFzcz0iY2xzLTYiIGQ9Ik0zMTUuNzgsNDYuMThjLTI1Ljg0LDcuNTMtMTI0LjMyLDM5LjQtMTg4LjA5LDEzNy4zMy03NC40MiwxMTQuMjgtNDIuNjgsMjQwLjI3LTM3LjE2LDI2MC42MiIvPgogICAgICA8cGF0aCBjbGFzcz0iY2xzLTYiIGQ9Ik0zMjYuNTEsNDYuMThjMTkuNzQsMzAuOTQsODMuNDEsMTM5LjAxLDY4LjkzLDI4Ni4wMS0xMC41OSwxMDcuNTItNTkuNjQsMTgzLjc3LTgzLjExLDIxNi4zNSIvPgogICAgICA8cGF0aCBjbGFzcz0iY2xzLTYiIGQ9Ik0zMjYuNTEsNDYuMThjOC4wOCwzLjY4LDE3MS42OCw4MS40MiwxODIuMiwyNDMuNjUsOS4yMSwxNDEuOTQtMTA2LjQyLDIzMC42My0xMTkuNjMsMjQwLjQyIi8+CiAgICAgIDxwYXRoIGNsYXNzPSJjbHMtNiIgZD0iTTMyMC4zNyw0NC4zOWMtMjkuMjEsMjMuNTUtODIuMzcsNzguOTctMTE3Ljk0LDE0NS43OS00Ni4zNiw4Ny4wOC01MC4yNywxNjYuNjctNTAuNTUsMTk2LjA4LS40Nyw0OS4wMywxMy45MiwxMDQuMjMsMjEuNDUsMTMxLjM5Ii8+CiAgICAgIDxwYXRoIGNsYXNzPSJjbHMtNiIgZD0iTTMyMS45MSw0NC42NGMtNi4wMiw4MS4xOS0xOC4wNiwxOTMuMDMtMzUuMjMsMjg3Ljk5LTEzLjMxLDczLjU2LTMwLjU4LDE0OC4yMy00Ny40OSwyMTEuNCIvPgogICAgICA8cGF0aCBjbGFzcz0iY2xzLTMiIGQ9Ik0zMDguNTMsMzIzLjQ4Yy0yMy4xNCwwLTQzLjcxLTEuMTEtNjEuNy0zLjM3LTE4LTIuMjQtMzMuMTEtNS42Mi00NS4zMS0xMC4xMiwwLDE1LjQyLDIuMjQsMjkuNCw2Ljc1LDQxLjk0LDQuNDksMTIuNTMsMTEuNTcsMjIuOTksMjEuMjEsMzEuMzMsOS42NCw5LjY0LDIwLjU2LDE2LjM5LDMyLjc4LDIwLjI0LDEyLjIsMy44NiwyNi4wMyw1Ljc4LDQxLjQ1LDUuNzgsMTAuOTIsMCwyMy4yOS0uOCwzNy4xMi0yLjQxLDEzLjgxLTEuNiwyOC43Ni00Ljk3LDQ0LjgzLTEwLjEyLDguOTktMi41NiwxNi4yMi0yLjU2LDIxLjY5LDAsNS40NSwyLjU4LDkuNDcsNy40LDEyLjA1LDE0LjQ2LDEuOTMsOS4wMS42MywxNi4zOS0zLjg2LDIyLjE3LTQuNSw1Ljc4LTExLjU3LDEwLjI5LTIxLjIxLDEzLjUtMTMuNSw1LjE1LTI3LjgxLDguNjgtNDIuOSwxMC42LTE1LjExLDEuOTMtMzEuMDEsMi44OS00Ny43MiwyLjg5LTI1LjA2LDAtNDcuMjQtMy4zNy02Ni41Mi0xMC4xMnMtMzUuMzUtMTcuNS00OC4yLTMyLjI5Yy0xNC4xNC0xMy41LTI0LjU4LTI5LjcyLTMxLjMzLTQ4LjY4LTYuNzUtMTguOTUtMTAuMTItNDAuMDEtMTAuMTItNjMuMTQsMC0yNS4wNiwzLjY5LTQ4LjA0LDExLjA5LTY4LjkzLDcuMzgtMjAuODgsMTguOC0zOS42OCwzNC4yMi01Ni40LDE0LjEzLTE1LjQyLDMyLjI5LTI3LjQ4LDU0LjQ3LTM2LjE1LDIyLjE3LTguNjgsNDguMDQtMTMuMDEsNzcuNi0xMy4wMSwxNy4zNSwwLDMzLjA5LDIuNzQsNDcuMjQsOC4xOSwxNC4xMyw1LjQ3LDI2Ljk5LDEyLjM4LDM4LjU2LDIwLjczLDEwLjI3LDkuNjQsMTguNDcsMjAuMDksMjQuNTgsMzEuMzMsNi4xLDExLjI1LDkuMTYsMjIuOTksOS4xNiwzNS4xOSwwLDE2LjA3LTMuMDYsMzAuMDUtOS4xNiw0MS45NC02LjEyLDExLjktMTQuOTQsMjEuNjktMjYuNTEsMjkuNC0xMS41Nyw4LjM2LTI1LjcxLDE0LjYzLTQyLjQyLDE4LjgtMTYuNzIsNC4xOS0zNiw2LjI3LTU3Ljg0LDYuMjdaTTIwOC4yNywyNTguODljMTIuODUsNS4xNSwyOC40NCw4Ljg0LDQ2Ljc2LDExLjA5LDE4LjMyLDIuMjYsMzguNzEsMy4zNyw2MS4yMiwzLjM3LDExLjU3LDAsMjEuODQtLjYzLDMwLjg1LTEuOTMsOC45OS0xLjI4LDE3LjAyLTMuODYsMjQuMS03LjcxLDYuNDItMi41NiwxMS4yNC02LjksMTQuNDYtMTMuMDEsMy4yMS02LjEsNC44Mi0xMy45OCw0LjgyLTIzLjYyLDAtNC40OS0xLjMtOS4zMS0zLjg2LTE0LjQ2LTIuNTgtNS4xNC02LjEyLTEwLjI3LTEwLjYtMTUuNDItNS43OC00LjQ5LTEyLjg2LTguMDMtMjEuMjEtMTAuNi04LjM2LTIuNTYtMTguMzItMy44Ni0yOS44OS0zLjg2LTIwLjU4LDAtMzguNDEsMi44OS01My41LDguNjgtMTUuMTEsNS43OC0yNy44MSwxNC4xNC0zOC4wOCwyNS4wNi01Ljc4LDYuNDMtMTAuOTQsMTMuMTgtMTUuNDIsMjAuMjQtNC41LDcuMDgtNy43MSwxNC40Ni05LjY0LDIyLjE3WiIvPgogICAgICA8cGF0aCBjbGFzcz0iY2xzLTEiIGQ9Ik01NTIsMTE1YzAtNDEuNDItMzMuNTgtNzUtNzUtNzUtLjAzLDAtLjA1LDAtLjA4LDAtLjAzLDAtLjA1LDAtLjA4LDAtNDEuNDIsMC03NSwzMy41OC03NSw3NXM2MC4yOSwxNzEuNDYsNzUsMjAxLjA4Yy4wMi4wNC4wNC4wOC4wNi4xMnYuMDZzLjAxLS4wMi4wMi0uMDNjMCwuMDEuMDEuMDIuMDIuMDN2LS4wNnMuMDQtLjA4LjA2LS4xMmMxNC43MS0yOS42Miw3NS0xNTkuNjUsNzUtMjAxLjA4WiIvPgogICAgICA8Y2lyY2xlIGNsYXNzPSJjbHMtMyIgY3g9IjQ3Ni45MiIgY3k9IjExNC40MiIgcj0iNDQuNSIvPgogICAgPC9nPgogIDwvZz4KPC9zdmc+`;

export class AppLayout {
  constructor(containerId = 'app') {
    this.container = document.getElementById(containerId);
  }

  /**
   * 레이아웃 HTML 생성 및 삽입
   */
  render() {
    this.container.innerHTML = `
      <!-- 메뉴바 -->
      <header id="menubar">
        <div class="menu-left">
          <div class="app-logo">
            ${logoMarkSvg}
          </div>
        </div>
        <div class="menu-center">
          <div class="menu-items">
            <div class="menu-item dropdown" data-menu="project">
              <button class="menu-button" title="프로젝트"><span class="menu-btn-icon">📁</span><span class="menu-btn-label">프로젝트</span></button>
              <div class="dropdown-menu" id="menu-project">
                <div class="dropdown-item" data-action="project-new">새 프로젝트</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" data-action="project-open">열기...</div>
                <div class="dropdown-item" data-action="project-save">저장</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item submenu-label">최근 파일</div>
                <div class="recent-files-list" id="recent-files-list">
                  <div class="dropdown-item disabled">최근 파일 없음</div>
                </div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" data-action="project-export">지도 내보내기</div>
              </div>
            </div>
            <div class="menu-item dropdown" data-menu="edit">
              <button class="menu-button" title="편집"><span class="menu-btn-icon">✏️</span><span class="menu-btn-label">편집</span></button>
              <div class="dropdown-menu" id="menu-edit">
                <div class="dropdown-item" data-action="edit-merge">피처 합치기</div>
                <div class="dropdown-item" data-action="edit-split">피처 자르기</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" data-action="edit-delete">선택 피처 삭제</div>
                <div class="dropdown-item" data-action="edit-select-all">모두 선택</div>
                <div class="dropdown-item" data-action="edit-deselect">선택 해제</div>
              </div>
            </div>
            <div class="menu-item dropdown" data-menu="view">
              <button class="menu-button" title="보기"><span class="menu-btn-icon">🔍</span><span class="menu-btn-label">보기</span></button>
              <div class="dropdown-menu" id="menu-view">
                <div class="dropdown-item" data-action="view-zoom-in">확대</div>
                <div class="dropdown-item" data-action="view-zoom-out">축소</div>
                <div class="dropdown-item" data-action="view-full-extent">전체 범위</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" data-action="view-zoom-layer">선택 레이어로 이동</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" data-action="view-toggle-panel">패널 표시/숨기기</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" data-action="view-bookmarks">북마크 관리</div>
              </div>
            </div>
            <div class="menu-item dropdown" data-menu="layer">
              <button class="menu-button" title="레이어"><span class="menu-btn-icon">📑</span><span class="menu-btn-label">레이어</span></button>
              <div class="dropdown-menu" id="menu-layer">
                <div class="dropdown-item" data-action="layer-from-coords">좌표 데이터 가져오기</div>
                <div class="dropdown-item" data-action="layer-remove">레이어 삭제</div>
                <div class="dropdown-item" data-action="layer-rename">이름 변경</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" data-action="layer-attribute-table">속성 테이블</div>
                <div class="dropdown-item" data-action="layer-table-join">테이블 결합</div>
                <div class="dropdown-item" data-action="layer-label">라벨 설정</div>
                <div class="dropdown-item" data-action="layer-field-calculator">필드 계산기</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" data-action="layer-merge">레이어 합치기</div>
                <div class="dropdown-item" data-action="layer-split">레이어 나누기</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" data-action="layer-export">레이어 내보내기</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" data-action="layer-clear-all">모든 레이어 삭제</div>
              </div>
            </div>
            <div class="menu-item dropdown" data-menu="measure">
              <button class="menu-button" title="측정"><span class="menu-btn-icon">📏</span><span class="menu-btn-label">측정</span></button>
              <div class="dropdown-menu" id="menu-measure">
                <div class="dropdown-item" data-action="analysis-measure-distance">거리 측정</div>
                <div class="dropdown-item" data-action="analysis-measure-area">면적 측정</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" data-action="analysis-clear-measures">측정 결과 지우기</div>
              </div>
            </div>
            <div class="menu-item dropdown" data-menu="vector-analysis">
              <button class="menu-button" title="벡터 분석"><span class="menu-btn-icon">📊</span><span class="menu-btn-label">벡터 분석</span></button>
              <div class="dropdown-menu" id="menu-vector-analysis">
                <div class="dropdown-item" data-action="analysis-grid">격자 만들기</div>
                <div class="dropdown-item" data-action="analysis-buffer">버퍼 분석</div>
                <div class="dropdown-item" data-action="analysis-voronoi">보로노이 다이어그램 (티센&nbsp;폴리곤)</div>
                <div class="dropdown-item" data-action="analysis-spatial-ops">공간 연산</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" data-action="analysis-isochrone">등시선 분석</div>
                <div class="dropdown-item" data-action="analysis-routing">최단경로 분석</div>
              </div>
            </div>
            <div class="menu-item dropdown" data-menu="raster-analysis">
              <button class="menu-button" title="래스터 분석"><span class="menu-btn-icon">🏔</span><span class="menu-btn-label">래스터 분석</span></button>
              <div class="dropdown-menu" id="menu-raster-analysis">
                <div class="dropdown-item" data-action="analysis-terrain">해발고도 (지형음영)</div>
                <div class="dropdown-item" data-action="analysis-slope">경사도 (Slope)</div>
                <div class="dropdown-item" data-action="analysis-aspect">경사방향 (Aspect)</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" data-action="analysis-raster-filter">래스터 계산기 (값 필터)</div>
                <div class="dropdown-item" data-action="analysis-contour">등고선 생성</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" data-action="georeference">지리참조 (Georeferencing)</div>
              </div>
            </div>
            <div class="menu-item dropdown" data-menu="thematic-map">
              <button class="menu-button" title="주제도"><span class="menu-btn-icon">🗺️</span><span class="menu-btn-label">주제도</span></button>
              <div class="dropdown-menu" id="menu-thematic-map">
                <div class="dropdown-item" data-action="analysis-choropleth">단계구분도</div>
                <div class="dropdown-item" data-action="analysis-chart-map">도형표현도</div>
                <div class="dropdown-item" data-action="analysis-heatmap">히트맵</div>
                <div class="dropdown-item" data-action="analysis-cartogram">카토그램</div>
              </div>
            </div>
            <div class="menu-item" data-menu="builtin-data">
              <button class="menu-button" data-action="builtin-data" title="데이터 불러오기" style="color: var(--color-primary); font-weight: 600;"><span class="menu-btn-icon">📂</span><span class="menu-btn-label">📂 데이터 불러오기</span></button>
            </div>
            <a href="/guide" class="btn-community btn-guide" id="btn-guide" target="_blank" rel="noopener" title="e-GIS 사용 설명서">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
              GUIDE
            </a>
            <a href="https://cafe.naver.com/egiskr" class="btn-community" target="_blank" title="e-GIS 커뮤니티">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              커뮤니티
            </a>
          </div>
        </div>
        <div class="menu-right">
          <a href="/privacy" class="header-privacy-link" target="_blank" title="개인정보 처리방침">개인정보 처리방침</a>
          <div class="header-auth" id="header-auth">
            <button class="btn btn-sm btn-primary" id="header-login-btn"><span class="auth-label-ko">로그인</span><span class="auth-label-en">Login</span></button>
          </div>
          <button id="theme-toggle" class="theme-toggle" title="테마 전환">
            <svg class="icon-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <svg class="icon-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none;">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          </button>
          <!-- 도구 모음 접기/펴기 — 접으면 툴바 줄이 통째로 사라진다 -->
          <button class="toolbar-collapse-btn" id="toolbar-collapse" title="도구 모음 접기/펴기" aria-label="도구 모음 접기/펴기">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="18 15 12 9 6 15"></polyline>
            </svg>
          </button>
        </div>
      </header>

      <!-- 툴바 -->
      <div id="toolbar">
        <div class="toolbar-group" data-group="navigation">
          <button class="btn-icon" data-tool="zoom-in" title="확대">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="11" y1="8" x2="11" y2="14"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
          </button>
          <button class="btn-icon" data-tool="zoom-out" title="축소">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
          </button>
          <button class="btn-icon" data-tool="zoom-extent" title="전체 범위">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          </button>
        </div>

        <div class="toolbar-group" data-group="select">
          <button class="btn-icon" data-tool="select" title="선택 (드래그로 범위 선택)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
            </svg>
          </button>
          <button class="btn-icon" id="btn-feature-info" title="선택한 피처 속성 보기" style="display:none">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <circle cx="12" cy="12" r="9.6"></circle>
              <circle cx="12" cy="7" r="1.6" fill="currentColor" stroke="none"></circle>
              <line x1="12" y1="10.8" x2="12" y2="17.4" stroke-width="3.2"></line>
            </svg>
          </button>
          <button class="btn-icon selection-action" id="btn-clear-selection" title="선택 취소" style="display:none">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <button class="btn-icon selection-action btn-icon-danger" id="btn-delete-selection" title="선택 피처 삭제" style="display:none">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
              <path d="M10 11v6M14 11v6"></path>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
            </svg>
          </button>
          <button class="btn-icon" id="btn-merge-features" title="피처 합치기 (선택한 피처들을 박음질하듯 하나로. 다른 레이어끼리 합치면 새 레이어가 생깁니다)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" fill-opacity="0.18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="4" width="8.5" height="16" rx="1.5"/>
              <rect x="13.5" y="4" width="8.5" height="16" rx="1.5"/>
              <path d="M12 3.5 L10 7 L14 10.5 L10 14 L14 17.5 L12 20.5" fill="none"/>
            </svg>
          </button>
          <button class="btn-icon" data-tool="edit-split" title="피처 자르기 (선을 그어 분할)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="6" cy="6" r="3"/>
              <circle cx="6" cy="18" r="3"/>
              <line x1="20" y1="4" x2="8.12" y2="15.88"/>
              <line x1="14.47" y1="14.48" x2="20" y2="20"/>
              <line x1="8.12" y1="8.12" x2="12" y2="12"/>
            </svg>
          </button>
        </div>

        <div class="toolbar-group" data-group="draw">
          <button class="btn-icon" data-tool="draw-point" title="점 그리기">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="4"/>
            </svg>
          </button>
          <button class="btn-icon" data-tool="draw-line" title="선 그리기">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="19" x2="19" y2="5"/>
              <circle cx="5" cy="19" r="2" fill="currentColor"/>
              <circle cx="19" cy="5" r="2" fill="currentColor"/>
            </svg>
          </button>
          <button class="btn-icon" data-tool="draw-polygon" title="면 그리기">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5"/>
            </svg>
          </button>
          <button class="btn-icon" data-tool="draw-multipoint" title="멀티포인트 (다시 클릭하면 저장)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="6" cy="12" r="3"/>
              <circle cx="12" cy="6" r="3"/>
              <circle cx="18" cy="14" r="3"/>
            </svg>
          </button>
          <button class="btn-icon" data-tool="draw-multiline" title="멀티라인 (다시 클릭하면 저장)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2 8 L8 4 L14 10"/>
              <path d="M10 20 L16 14 L22 18"/>
            </svg>
          </button>
          <button class="btn-icon" data-tool="draw-multipolygon" title="멀티폴리곤 (다시 클릭하면 저장)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" opacity="0.5" stroke="currentColor" stroke-width="1">
              <rect x="2" y="2" width="9" height="9"/>
              <rect x="13" y="13" width="9" height="9"/>
            </svg>
          </button>
        </div>

        <div class="toolbar-group" data-group="measure">
          <button class="btn-icon" data-tool="measure-distance" title="거리 측정">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2 12h20M2 12l4-4M2 12l4 4M22 12l-4-4M22 12l-4 4"/>
            </svg>
          </button>
          <button class="btn-icon" data-tool="measure-area" title="면적 측정">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M3 9h18M9 3v18"/>
            </svg>
          </button>
          <button class="btn-icon" data-tool="clear-measures" title="측정 결과 지우기">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>
              <path d="M10 11v5M14 11v5"/>
            </svg>
          </button>
        </div>

        <div class="toolbar-group" data-group="image">
          <button class="btn-icon" data-tool="upload-image" title="이미지 업로드 (PNG/JPG/SVG)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </button>
          <button class="btn-icon" id="view3d-toggle" data-tool="view3d" title="3D로 보기" aria-pressed="false">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
              <path d="M12 2 22 7.5v9L12 22 2 16.5v-9L12 2z"/>
              <path d="M2 7.5 12 13l10-5.5M12 13v9"/>
            </svg>
          </button>
        </div>

        <div class="toolbar-spacer"></div>

        <!-- 카피라이트 -->
        <span class="toolbar-copyright">ⓒ 2025 양정고등학교 김용현T | bgnlkim@gmail.com</span>

        <!-- 위치 검색 -->
        <div class="toolbar-search" id="toolbar-search">
          <div class="search-input-wrapper">
            <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" id="location-search-input" placeholder="장소 검색..." autocomplete="off">
            <button class="search-clear" id="search-clear" title="지우기" style="display:none;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="search-results" id="search-results" style="display:none;"></div>
        </div>
      </div>

      <!-- 메인 컨테이너 -->
      <div id="main-container">
        <!-- 왼쪽 패널 (탭) -->
        <aside id="left-panel">
          <div class="panel-tabs">
            <button class="panel-tab active" data-tab="layers"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>레이어</button>
            <button class="panel-tab" data-tab="browser"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>브라우저</button>
          </div>
          <div id="tab-layers" class="tab-content active">
            <div class="panel-header"><label class="layer-select-all" title="전체 표시/숨김"><input type="checkbox" id="layer-select-all"></label><span class="panel-header-title">레이어 목록</span><div class="panel-header-actions"><button class="btn-icon btn-small" id="btn-add-layer" title="새 레이어 추가"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></button></div></div>
            <div class="panel-content"><ul id="layer-list" class="layer-list"></ul></div>
          </div>
          <div id="tab-browser" class="tab-content">
            <div class="panel-header"><span class="panel-header-title">파일 업로드</span></div>
            <div class="panel-content">
              <div class="file-drop-zone" id="file-drop-zone">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:8px;opacity:0.6;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                <p>파일·폴더를 드래그하거나<br>클릭하여 업로드</p>
                <p class="file-types">GeoJSON, Shapefile(ZIP/폴더), GPKG, DEM(TIF/IMG)</p>
              </div>
              <button type="button" class="btn btn-sm" id="btn-open-folder" style="width:100%;margin-top:8px;">📁 Shapefile 폴더 열기</button>
              <p class="file-types" style="margin-top:6px;opacity:0.7;font-size:11px;">Shapefile은 폴더째 드래그하거나 ZIP으로 넣으면 속성(.dbf)까지 함께 불러옵니다.</p>
            </div>
          </div>
        </aside>

        <!-- 패널 리사이저 -->
        <div class="panel-resizer" id="panel-resizer"></div>

        <!-- 지도 컨테이너 -->
        <main id="map-container">
          <div id="map"></div>
          <button id="sidebar-toggle" class="sidebar-toggle" title="사이드바 접기/펴기" aria-label="사이드바 접기/펴기">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <div id="view3d-controls" class="view3d-controls">
            <div id="view3d-panel" class="view3d-panel" hidden>
              <label class="view3d-row">
                세로 과장
                <input type="range" id="view3d-exaggeration" min="1" max="10" step="0.5" value="2">
                <output id="view3d-exaggeration-value">2배</output>
              </label>
              <label class="view3d-row">
                지형
                <select id="view3d-terrain"></select>
              </label>
              <label class="view3d-row">
                배경지도
                <select id="view3d-basemap">
                  <option value="OSM">일반지도</option>
                  <option value="SATELLITE">위성</option>
                  <option value="SATELLITE_LABELS">위성 + 라벨</option>
                  <option value="NONE">없음</option>
                </select>
              </label>
              <p class="view3d-hint">
                표면에 무엇을 올릴지는 레이어 목록에서 켜고 끄면 됩니다.
                더블클릭한 곳이 회전 중심(빨간 점)이 됩니다.
              </p>
              <button id="view3d-save" class="view3d-save">PNG로 저장</button>
            </div>
          </div>
        </main>
      </div>

      <!-- 상태표시줄 -->
      <footer id="statusbar">
        <div class="statusbar-item coordinates" id="status-coords">
          <span class="coord-label">좌표:</span>
          <span class="coord-value">---, ---</span>
        </div>
        <div class="statusbar-item scale" id="status-scale">
          <span class="scale-label">1:</span>
          <input type="text" class="scale-input" id="scale-input" value="---" title="축척 입력 (Enter로 적용)">
        </div>
        <div class="statusbar-item crs" id="status-crs" title="좌표계 변경">
          <span class="crs-value">EPSG:4326</span>
        </div>
        <div class="statusbar-spacer"></div>
        <div class="statusbar-item visitor-counter" title="조회수">
          <span class="visitor-label">Today</span>
          <span class="visitor-value" id="visitor-today">-</span>
          <span class="visitor-sep">|</span>
          <span class="visitor-label">Total</span>
          <span class="visitor-value" id="visitor-total">-</span>
        </div>
        <div class="statusbar-item">
          <span id="status-message">준비</span>
        </div>
      </footer>
    `;

    this.addStyles();
    this.initResizer();
    this.initTabs();
    this.initSidebarToggle();
    this.initToolbarCollapse();
    this.setFavicon();
  }

  /**
   * 툴바 접기/펴기 토글 (지도를 넓게 보고 싶을 때 — 화면 크기와 무관하게 동작)
   */
  initToolbarCollapse() {
    const btn = document.getElementById('toolbar-collapse');
    const toolbar = document.getElementById('toolbar');
    if (!btn || !toolbar) return;

    btn.addEventListener('click', () => {
      const collapsed = toolbar.classList.toggle('collapsed');
      // 화살표 방향과 안내 문구를 상태에 맞춘다
      btn.classList.toggle('collapsed', collapsed);
      btn.title = collapsed ? '도구 모음 펴기' : '도구 모음 접기';
      // 툴바가 사라지면 지도 높이가 바뀌므로 다시 재도록 알린다
      window.dispatchEvent(new Event('resize'));
    });
  }

  /**
   * 파비콘 설정
   */
  setFavicon() {
    // 기존 파비콘 제거
    const existingFavicon = document.querySelector('link[rel="icon"]');
    if (existingFavicon) {
      existingFavicon.href = faviconSvg;
    } else {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      link.href = faviconSvg;
      document.head.appendChild(link);
    }
  }

  /**
   * 추가 스타일 삽입
   */
  addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* 메뉴바 스타일 */
      #menubar {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .app-logo {
        display: flex;
        align-items: center;
        margin-right: var(--spacing-lg);
      }

      .menu-items {
        display: flex;
        gap: var(--spacing-xs);
      }

      .menu-button {
        padding: var(--spacing-xs) var(--spacing-sm);
        font-size: var(--font-size-sm);
        border-radius: var(--radius-sm);
        transition: background var(--transition-fast);
      }

      .menu-button:hover {
        background: var(--bg-hover);
      }

      /* 테마 아이콘 전환 */
      [data-theme="dark"] .icon-sun {
        display: none !important;
      }
      [data-theme="dark"] .icon-moon {
        display: block !important;
      }
      [data-theme="light"] .icon-sun,
      :root .icon-sun {
        display: block !important;
      }
      [data-theme="light"] .icon-moon,
      :root .icon-moon {
        display: none !important;
      }

      /* 툴바 스타일 */
      .toolbar-spacer {
        flex: 1;
      }

      .btn-icon-danger:hover {
        color: #fff;
        background: #dc3545;
      }

      .toolbar-copyright {
        font-size: 11px;
        color: var(--text-muted);
        margin-right: 12px;
        white-space: nowrap;
      }

      /* 파일 드롭 존 */
      .file-drop-zone {
        border: 2px dashed var(--border-color);
        border-radius: var(--radius-md);
        padding: var(--spacing-lg);
        text-align: center;
        color: var(--text-muted);
        font-size: var(--font-size-sm);
        cursor: pointer;
        transition: all var(--transition-fast);
      }

      .file-drop-zone:hover,
      .file-drop-zone.dragover {
        border-color: var(--color-primary);
        background: var(--color-primary-light);
      }

      .file-drop-zone .file-types {
        font-size: var(--font-size-xs);
        margin-top: var(--spacing-xs);
      }

      /* 레이어 리스트 */
      .layer-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .layer-item {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        padding: var(--spacing-sm);
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: background var(--transition-fast);
      }

      .layer-item:hover {
        background: var(--bg-hover);
      }

      .layer-item.selected {
        background: var(--bg-selected);
      }

      .layer-item input[type="checkbox"] {
        margin: 0;
      }

      .layer-item .layer-name {
        flex: 1;
        font-size: var(--font-size-sm);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* 드래그 앤 드롭 스타일 */
      .layer-item.dragging {
        opacity: 0.5;
        background: var(--bg-selected);
      }

      .layer-item.drop-above {
        border-top: 2px solid var(--color-primary);
        margin-top: -1px;
      }

      .layer-item.drop-below {
        border-bottom: 2px solid var(--color-primary);
        margin-bottom: -1px;
      }

      .layer-item[draggable="true"] {
        cursor: grab;
      }

      .layer-item[draggable="true"]:active {
        cursor: grabbing;
      }

      /* 작은 버튼 */
      .btn-small { width: 22px; height: 22px; }
      .panel-tabs { display: flex; background: var(--bg-toolbar); border-bottom: 1px solid var(--border-color); flex-shrink: 0; }
      .panel-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: var(--spacing-sm) var(--spacing-md); font-size: var(--font-size-sm); color: var(--text-muted); background: transparent; border: none; border-bottom: 2px solid transparent; cursor: pointer; transition: all var(--transition-fast); }
      .panel-tab:hover { color: var(--text-primary); background: var(--bg-hover); }
      .panel-tab.active { color: var(--color-primary); border-bottom-color: var(--color-primary); background: var(--bg-panel); }
      .panel-tab svg { flex-shrink: 0; }
      .tab-content { display: none; flex-direction: column; flex: 1; overflow: hidden; }
      .tab-content.active { display: flex; }
    `;
    document.head.appendChild(style);
  }

  
  initTabs() {
    const tabs = document.querySelectorAll('.panel-tab');
    const contents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-' + targetTab).classList.add('active');
      });
    });
  }

  /**
   * 패널 리사이저 초기화
   */
  initResizer() {
    const resizer = document.getElementById('panel-resizer');
    const leftPanel = document.getElementById('left-panel');
    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
      isResizing = true;
      resizer.classList.add('active');
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;

      const newWidth = e.clientX;
      const minWidth = parseInt(getComputedStyle(leftPanel).minWidth);
      const maxWidth = parseInt(getComputedStyle(leftPanel).maxWidth);

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        leftPanel.style.width = `${newWidth}px`;
      }
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        resizer.classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        // 지도 크기 갱신 이벤트 발생
        window.dispatchEvent(new Event('resize'));
      }
    });
  }

  /**
   * 사이드바 접기/펴기 토글
   */
  initSidebarToggle() {
    const btn = document.getElementById('sidebar-toggle');
    const leftPanel = document.getElementById('left-panel');
    const resizer = document.getElementById('panel-resizer');

    // 모바일에서는 지도가 먼저 보이도록 패널을 접은 상태로 시작
    if (window.matchMedia('(max-width: 768px)').matches) {
      leftPanel.classList.add('hidden');
      btn.classList.add('collapsed');
      if (resizer) resizer.style.display = 'none';
    }

    btn.addEventListener('click', () => {
      const collapsed = leftPanel.classList.toggle('hidden');
      if (resizer) resizer.style.display = collapsed ? 'none' : '';
      btn.classList.toggle('collapsed', collapsed);
      window.dispatchEvent(new Event('resize'));
    });
  }
}
