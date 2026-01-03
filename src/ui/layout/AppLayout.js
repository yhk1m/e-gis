/**
 * AppLayout - 전체 앱 레이아웃 구조 생성
 */

// SVG를 Base64 데이터 URI로 인코딩하여 파일 서빙 문제 해결
const logoSvg = `data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyBpZD0iX+ugiOydtOyWtF8yIiBkYXRhLW5hbWU9IuugiOydtOyWtCAyIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDY5LjIyIDU5MiI+CiAgPGRlZnM+CiAgICA8c3R5bGU+CiAgICAgIC5jbHMtMSB7CiAgICAgICAgc3Ryb2tlLXdpZHRoOiA2MC43NnB4OwogICAgICB9CgogICAgICAuY2xzLTEsIC5jbHMtMiwgLmNscy0zLCAuY2xzLTQsIC5jbHMtNSwgLmNscy02LCAuY2xzLTcgewogICAgICAgIHN0cm9rZS1taXRlcmxpbWl0OiAxMDsKICAgICAgfQoKICAgICAgLmNscy0xLCAuY2xzLTIsIC5jbHMtNCwgLmNscy01LCAuY2xzLTYsIC5jbHMtNyB7CiAgICAgICAgc3Ryb2tlOiAjZmZmOwogICAgICB9CgogICAgICAuY2xzLTgsIC5jbHMtNCB7CiAgICAgICAgZmlsbDogI2U2MDAxMjsKICAgICAgfQoKICAgICAgLmNscy05LCAuY2xzLTUgewogICAgICAgIGZpbGw6ICNmZmY7CiAgICAgIH0KCiAgICAgIC5jbHMtMiB7CiAgICAgICAgZmlsbDogIzRjYWY1MDsKICAgICAgfQoKICAgICAgLmNscy0yLCAuY2xzLTQsIC5jbHMtNSwgLmNscy02IHsKICAgICAgICBzdHJva2Utd2lkdGg6IDgwcHg7CiAgICAgIH0KCiAgICAgIC5jbHMtMyB7CiAgICAgICAgc3Ryb2tlOiAjODQ4Nzg0OwogICAgICAgIHN0cm9rZS13aWR0aDogNXB4OwogICAgICB9CgogICAgICAuY2xzLTMsIC5jbHMtNiB7CiAgICAgICAgZmlsbDogbm9uZTsKICAgICAgICBzdHJva2UtbGluZWNhcDogcm91bmQ7CiAgICAgIH0KCiAgICAgIC5jbHMtMTAgewogICAgICAgIGZpbGw6ICMwNmM7CiAgICAgIH0KCiAgICAgIC5jbHMtNyB7CiAgICAgICAgc3Ryb2tlLXdpZHRoOiA2My43MXB4OwogICAgICB9CiAgICA8L3N0eWxlPgogIDwvZGVmcz4KICA8ZyBpZD0iX+ugiOydtOyWtF8xLTIiIGRhdGEtbmFtZT0i66CI7J207Ja0IDEiPgogICAgPGc+CiAgICAgIDxwYXRoIGNsYXNzPSJjbHMtMiIgZD0iTTU1MiwyOTZjMCwxNDEuMzgtMTE0LjYyLDI1Ni0yNTYsMjU2UzQwLDQzNy4zOSw0MCwyOTYsMTU0LjYyLDQwLDI5Niw0MGM0LjM1LDAsMTAuMTYtLjAzLDE3LjM5LjU4LDk5LjU2LDguNDEsMjM4LjYxLDEwMy4wMSwyMzguNjEsMjU1LjQyWiIvPgogICAgICA8cGF0aCBjbGFzcz0iY2xzLTYiIGQ9Ik03OS40MSwxNjQuODZjMTMuNzIsMzAuNjMsNTEuOTgsMTAzLjUsMTMzLjIsMTUxLjksMTQ3LjMzLDg3LjgsMzExLjYxLDMxLjMyLDMyOS44NSwyNC43MyIvPgogICAgICA8cGF0aCBjbGFzcz0iY2xzLTYiIGQ9Ik0xODUuMDYsNjYuNjNjMTEuMywyOS45NCw0Mi43NywxMDEuNTcsMTA0Ljk0LDE0Ni4wMywxMTIuNzgsODAuNjUsMjMzLjAzLDE2LjM5LDI0Ni4zNyw4LjkzIi8+CiAgICAgIDxwYXRoIGNsYXNzPSJjbHMtNiIgZD0iTTQyLjM0LDMwMy4yNmMxNC4wOCwzMi4yOCw1NC41NiwxMDcuNDUsMTMyLDE1NS4zOSwxNDAuNDgsODYuOTcsMjkwLjI2LDE3LjY3LDMwNi44OCw5LjYzIi8+CiAgICAgIDxwYXRoIGNsYXNzPSJjbHMtNiIgZD0iTTMxNS43OCw0Ni4xOGMtMjUuODQsNy41My0xMjQuMzIsMzkuNC0xODguMDksMTM3LjMzLTc0LjQyLDExNC4yOC00Mi42OCwyNDAuMjctMzcuMTYsMjYwLjYyIi8+CiAgICAgIDxwYXRoIGNsYXNzPSJjbHMtNiIgZD0iTTMyNi41MSw0Ni4xOGMxOS43NCwzMC45NCw4My40MSwxMzkuMDEsNjguOTMsMjg2LjAxLTEwLjU5LDEwNy41Mi01OS42NCwxODMuNzctODMuMTEsMjE2LjM1Ii8+CiAgICAgIDxwYXRoIGNsYXNzPSJjbHMtNiIgZD0iTTMyNi41MSw0Ni4xOGM4LjA4LDMuNjgsMTcxLjY4LDgxLjQyLDE4Mi4yLDI0My42NSw5LjIxLDE0MS45NC0xMDYuNDIsMjMwLjYzLTExOS42MywyNDAuNDIiLz4KICAgICAgPHBhdGggY2xhc3M9ImNscy02IiBkPSJNMzIwLjM3LDQ0LjM5Yy0yOS4yMSwyMy41NS04Mi4zNyw3OC45Ny0xMTcuOTQsMTQ1Ljc5LTQ2LjM2LDg3LjA4LTUwLjI3LDE2Ni42Ny01MC41NSwxOTYuMDgtLjQ3LDQ5LjAzLDEzLjkyLDEwNC4yMywyMS40NSwxMzEuMzkiLz4KICAgICAgPHBhdGggY2xhc3M9ImNscy02IiBkPSJNMzIxLjkxLDQ0LjY0Yy02LjAyLDgxLjE5LTE4LjA2LDE5My4wMy0zNS4yMywyODcuOTktMTMuMzEsNzMuNTYtMzAuNTgsMTQ4LjIzLTQ3LjQ5LDIxMS40Ii8+CiAgICAgIDxwYXRoIGNsYXNzPSJjbHMtNSIgZD0iTTMwOC41MywzMjMuNDhjLTIzLjE0LDAtNDMuNzEtMS4xMS02MS43LTMuMzctMTgtMi4yNC0zMy4xMS01LjYyLTQ1LjMxLTEwLjEyLDAsMTUuNDIsMi4yNCwyOS40LDYuNzUsNDEuOTQsNC40OSwxMi41MywxMS41NywyMi45OSwyMS4yMSwzMS4zMyw5LjY0LDkuNjQsMjAuNTYsMTYuMzksMzIuNzgsMjAuMjQsMTIuMiwzLjg2LDI2LjAzLDUuNzgsNDEuNDUsNS43OCwxMC45MiwwLDIzLjI5LS44LDM3LjEyLTIuNDEsMTMuODEtMS42LDI4Ljc2LTQuOTcsNDQuODMtMTAuMTIsOC45OS0yLjU2LDE2LjIyLTIuNTYsMjEuNjksMCw1LjQ1LDIuNTgsOS40Nyw3LjQsMTIuMDUsMTQuNDYsMS45Myw5LjAxLjYzLDE2LjM5LTMuODYsMjIuMTctNC41LDUuNzgtMTEuNTcsMTAuMjktMjEuMjEsMTMuNS0xMy41LDUuMTUtMjcuODEsOC42OC00Mi45LDEwLjYtMTUuMTEsMS45My0zMS4wMSwyLjg5LTQ3LjcyLDIuODktMjUuMDYsMC00Ny4yNC0zLjM3LTY2LjUyLTEwLjEycy0zNS4zNS0xNy41LTQ4LjItMzIuMjljLTE0LjE0LTEzLjUtMjQuNTgtMjkuNzItMzEuMzMtNDguNjgtNi43NS0xOC45NS0xMC4xMi00MC4wMS0xMC4xMi02My4xNCwwLTI1LjA2LDMuNjktNDguMDQsMTEuMDktNjguOTMsNy4zOC0yMC44OCwxOC44LTM5LjY4LDM0LjIyLTU2LjQsMTQuMTMtMTUuNDIsMzIuMjktMjcuNDgsNTQuNDctMzYuMTUsMjIuMTctOC42OCw0OC4wNC0xMy4wMSw3Ny42LTEzLjAxLDE3LjM1LDAsMzMuMDksMi43NCw0Ny4yNCw4LjE5LDE0LjEzLDUuNDcsMjYuOTksMTIuMzgsMzguNTYsMjAuNzMsMTAuMjcsOS42NCwxOC40NywyMC4wOSwyNC41OCwzMS4zMyw2LjEsMTEuMjUsOS4xNiwyMi45OSw5LjE2LDM1LjE5LDAsMTYuMDctMy4wNiwzMC4wNS05LjE2LDQxLjk0LTYuMTIsMTEuOS0xNC45NCwyMS42OS0yNi41MSwyOS40LTExLjU3LDguMzYtMjUuNzEsMTQuNjMtNDIuNDIsMTguOC0xNi43Miw0LjE5LTM2LDYuMjctNTcuODQsNi4yN1pNMjA4LjI3LDI1OC44OWMxMi44NSw1LjE1LDI4LjQ0LDguODQsNDYuNzYsMTEuMDksMTguMzIsMi4yNiwzOC43MSwzLjM3LDYxLjIyLDMuMzcsMTEuNTcsMCwyMS44NC0uNjMsMzAuODUtMS45Myw4Ljk5LTEuMjgsMTcuMDItMy44NiwyNC4xLTcuNzEsNi40Mi0yLjU2LDExLjI0LTYuOSwxNC40Ni0xMy4wMSwzLjIxLTYuMSw0LjgyLTEzLjk4LDQuODItMjMuNjIsMC00LjQ5LTEuMy05LjMxLTMuODYtMTQuNDYtMi41OC01LjE0LTYuMTItMTAuMjctMTAuNi0xNS40Mi01Ljc4LTQuNDktMTIuODYtOC4wMy0yMS4yMS0xMC42LTguMzYtMi41Ni0xOC4zMi0zLjg2LTI5Ljg5LTMuODYtMjAuNTgsMC0zOC40MSwyLjg5LTUzLjUsOC42OC0xNS4xMSw1Ljc4LTI3LjgxLDE0LjE0LTM4LjA4LDI1LjA2LTUuNzgsNi40My0xMC45NCwxMy4xOC0xNS40MiwyMC4yNC00LjUsNy4wOC03LjcxLDE0LjQ2LTkuNjQsMjIuMTdaIi8+CiAgICAgIDxnPgogICAgICAgIDxwYXRoIGNsYXNzPSJjbHMtNCIgZD0iTTU1MiwxMTVjMC00MS40Mi0zMy41OC03NS03NS03NS0uMDMsMC0uMDUsMC0uMDgsMC0uMDMsMC0uMDUsMC0uMDgsMC00MS40MiwwLTc1LDMzLjU4LTc1LDc1czYwLjI5LDE3MS40Niw3NSwyMDEuMDhjLjAyLjA0LjA0LjA4LjA2LjEydi4wNnMuMDEtLjAyLjAyLS4wM2MwLC4wMS4wMS4wMi4wMi4wM3YtLjA2cy4wNC0uMDguMDYtLjEyYzE0LjcxLTI5LjYyLDc1LTE1OS42NSw3NS0yMDEuMDhaIi8+CiAgICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTUiIGN4PSI0NzYuOTIiIGN5PSIxMTQuNDIiIHI9IjQ0LjUiLz4KICAgICAgPC9nPgogICAgICA8cGF0aCBjbGFzcz0iY2xzLTEwIiBkPSJNNTUyLDI5NmMwLDE0MS4zOC0xMTQuNjIsMjU2LTI1NiwyNTZTNDAsNDM3LjM5LDQwLDI5NiwxNTQuNjIsNDAsMjk2LDQwYzQuMzUsMCwxMC4xNi0uMDMsMTcuMzkuNTgsOTkuNTYsOC40MSwyMzguNjEsMTAzLjAxLDIzOC42MSwyNTUuNDJaIi8+CiAgICAgIDxwYXRoIGNsYXNzPSJjbHMtMyIgZD0iTTc5LjQxLDE2NC44NmMxMy43MiwzMC42Myw1MS45OCwxMDMuNSwxMzMuMiwxNTEuOSwxNDcuMzMsODcuOCwzMTEuNjEsMzEuMzIsMzI5Ljg1LDI0LjczIi8+CiAgICAgIDxwYXRoIGNsYXNzPSJjbHMtMyIgZD0iTTE4NS4wNiw2Ni42M2MxMS4zLDI5Ljk0LDQyLjc3LDEwMS41NywxMDQuOTQsMTQ2LjAzLDExMi43OCw4MC42NSwyMzMuMDMsMTYuMzksMjQ2LjM3LDguOTMiLz4KICAgICAgPHBhdGggY2xhc3M9ImNscy0zIiBkPSJNNDIuMzQsMzAzLjI2YzE0LjA4LDMyLjI4LDU0LjU2LDEwNy40NSwxMzIsMTU1LjM5LDE0MC40OCw4Ni45NywyOTAuMjYsMTcuNjcsMzA2Ljg4LDkuNjMiLz4KICAgICAgPHBhdGggY2xhc3M9ImNscy0zIiBkPSJNMzE1Ljc4LDQ2LjE4Yy0yNS44NCw3LjUzLTEyNC4zMiwzOS40LTE4OC4wOSwxMzcuMzMtNzQuNDIsMTE0LjI4LTQyLjY4LDI0MC4yNy0zNy4xNiwyNjAuNjIiLz4KICAgICAgPHBhdGggY2xhc3M9ImNscy0zIiBkPSJNMzI2LjUxLDQ2LjE4YzE5Ljc0LDMwLjk0LDgzLjQxLDEzOS4wMSw2OC45MywyODYuMDEtMTAuNTksMTA3LjUyLTU5LjY0LDE4My43Ny04My4xMSwyMTYuMzUiLz4KICAgICAgPHBhdGggY2xhc3M9ImNscy0zIiBkPSJNMzI2LjUxLDQ2LjE4YzguMDgsMy42OCwxNzEuNjgsODEuNDIsMTgyLjIsMjQzLjY1LDkuMjEsMTQxLjk0LTEwNi40MiwyMzAuNjMtMTE5LjYzLDI0MC40MiIvPgogICAgICA8cGF0aCBjbGFzcz0iY2xzLTMiIGQ9Ik0zMjAuMzcsNDQuMzljLTI5LjIxLDIzLjU1LTgyLjM3LDc4Ljk3LTExNy45NCwxNDUuNzktNDYuMzYsODcuMDgtNTAuMjcsMTY2LjY3LTUwLjU1LDE5Ni4wOC0uNDcsNDkuMDMsMTMuOTIsMTA0LjIzLDIxLjQ1LDEzMS4zOSIvPgogICAgICA8cGF0aCBjbGFzcz0iY2xzLTMiIGQ9Ik0zMjEuOTEsNDQuNjRjLTYuMDIsODEuMTktMTguMDYsMTkzLjAzLTM1LjIzLDI4Ny45OS0xMy4zMSw3My41Ni0zMC41OCwxNDguMjMtNDcuNDksMjExLjQiLz4KICAgICAgPHBhdGggY2xhc3M9ImNscy05IiBkPSJNMzA4LjUzLDMyMy40OGMtMjMuMTQsMC00My43MS0xLjExLTYxLjctMy4zNy0xOC0yLjI0LTMzLjExLTUuNjItNDUuMzEtMTAuMTIsMCwxNS40MiwyLjI0LDI5LjQsNi43NSw0MS45NCw0LjQ5LDEyLjUzLDExLjU3LDIyLjk5LDIxLjIxLDMxLjMzLDkuNjQsOS42NCwyMC41NiwxNi4zOSwzMi43OCwyMC4yNCwxMi4yLDMuODYsMjYuMDMsNS43OCw0MS40NSw1Ljc4LDEwLjkyLDAsMjMuMjktLjgsMzcuMTItMi40MSwxMy44MS0xLjYsMjguNzYtNC45Nyw0NC44My0xMC4xMiw4Ljk5LTIuNTYsMTYuMjItMi41NiwyMS42OSwwLDUuNDUsMi41OCw5LjQ3LDcuNCwxMi4wNSwxNC40NiwxLjkzLDkuMDEuNjMsMTYuMzktMy44NiwyMi4xNy00LjUsNS43OC0xMS41NywxMC4yOS0yMS4yMSwxMy41LTEzLjUsNS4xNS0yNy44MSw4LjY4LTQyLjksMTAuNi0xNS4xMSwxLjkzLTMxLjAxLDIuODktNDcuNzIsMi44OS0yNS4wNiwwLTQ3LjI0LTMuMzctNjYuNTItMTAuMTJzLTM1LjM1LTE3LjUtNDguMi0zMi4yOWMtMTQuMTQtMTMuNS0yNC41OC0yOS43Mi0zMS4zMy00OC42OC02Ljc1LTE4Ljk1LTEwLjEyLTQwLjAxLTEwLjEyLTYzLjE0LDAtMjUuMDYsMy42OS00OC4wNCwxMS4wOS02OC45Myw3LjM4LTIwLjg4LDE4LjgtMzkuNjgsMzQuMjItNTYuNCwxNC4xMy0xNS40MiwzMi4yOS0yNy40OCw1NC40Ny0zNi4xNSwyMi4xNy04LjY4LDQ4LjA0LTEzLjAxLDc3LjYtMTMuMDEsMTcuMzUsMCwzMy4wOSwyLjc0LDQ3LjI0LDguMTksMTQuMTMsNS40NywyNi45OSwxMi4zOCwzOC41NiwyMC43MywxMC4yNyw5LjY0LDE4LjQ3LDIwLjA5LDI0LjU4LDMxLjMzLDYuMSwxMS4yNSw5LjE2LDIyLjk5LDkuMTYsMzUuMTksMCwxNi4wNy0zLjA2LDMwLjA1LTkuMTYsNDEuOTQtNi4xMiwxMS45LTE0Ljk0LDIxLjY5LTI2LjUxLDI5LjQtMTEuNTcsOC4zNi0yNS43MSwxNC42My00Mi40MiwxOC44LTE2LjcyLDQuMTktMzYsNi4yNy01Ny44NCw2LjI3Wk0yMDguMjcsMjU4Ljg5YzEyLjg1LDUuMTUsMjguNDQsOC44NCw0Ni43NiwxMS4wOSwxOC4zMiwyLjI2LDM4LjcxLDMuMzcsNjEuMjIsMy4zNywxMS41NywwLDIxLjg0LS42MywzMC44NS0xLjkzLDguOTktMS4yOCwxNy4wMi0zLjg2LDI0LjEtNy43MSw2LjQyLTIuNTYsMTEuMjQtNi45LDE0LjQ2LTEzLjAxLDMuMjEtNi4xLDQuODItMTMuOTgsNC44Mi0yMy42MiwwLTQuNDktMS4zLTkuMzEtMy44Ni0xNC40Ni0yLjU4LTUuMTQtNi4xMi0xMC4yNy0xMC42LTE1LjQyLTUuNzgtNC40OS0xMi44Ni04LjAzLTIxLjIxLTEwLjYtOC4zNi0yLjU2LTE4LjMyLTMuODYtMjkuODktMy44Ni0yMC41OCwwLTM4LjQxLDIuODktNTMuNSw4LjY4LTE1LjExLDUuNzgtMjcuODEsMTQuMTQtMzguMDgsMjUuMDYtNS43OCw2LjQzLTEwLjk0LDEzLjE4LTE1LjQyLDIwLjI0LTQuNSw3LjA4LTcuNzEsMTQuNDYtOS42NCwyMi4xN1oiLz4KICAgICAgPHBhdGggY2xhc3M9ImNscy04IiBkPSJNNTUyLDExNWMwLTQxLjQyLTMzLjU4LTc1LTc1LTc1LS4wMywwLS4wNSwwLS4wOCwwLS4wMywwLS4wNSwwLS4wOCwwLTQxLjQyLDAtNzUsMzMuNTgtNzUsNzVzNjAuMjksMTcxLjQ2LDc1LDIwMS4wOGMuMDIuMDQuMDQuMDguMDYuMTJ2LjA2cy4wMS0uMDIuMDItLjAzYzAsLjAxLjAxLjAyLjAyLjAzdi0uMDZzLjA0LS4wOC4wNi0uMTJjMTQuNzEtMjkuNjIsNzUtMTU5LjY1LDc1LTIwMS4wOFoiLz4KICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTkiIGN4PSI0NzYuOTIiIGN5PSIxMTQuNDIiIHI9IjQ0LjUiLz4KICAgICAgPHBhdGggY2xhc3M9ImNscy0xIiBkPSJNNTkwLjk5LDM3Ni4yOXYtNDMuNDNoMTg0LjkzdjQzLjQzaC0xODQuOTNaIi8+CiAgICAgIDxwYXRoIGNsYXNzPSJjbHMtNyIgZD0iTTExMDAuMzYsNTUyYy01NS45NiwwLTEwNC45Mi0xMC41My0xNDYuODgtMzEuNTktNDEuOTctMjEuMDYtNzQuNjUtNTAuNzgtOTguMDQtODkuMTctMjMuNC0zOC4zOS0zNS4wOS04My45MS0zNS4wOS0xMzYuNTZzMTEuOTQtOTcuMjgsMzUuODItMTM1LjI0YzIzLjg4LTM3Ljk0LDU3LjE2LTY3LjM0LDk5Ljg1LTg4LjE4LDQyLjY5LTIwLjgzLDkyLjAxLTMxLjI2LDE0Ny45Ny0zMS4yNiwzMS44NCwwLDYwLjQyLDMuMDcsODUuNzQsOS4yMSwyNS4zMiw2LjE1LDQ5LjA4LDE1LjE0LDcxLjI3LDI2Ljk4bC0xLjQ1LDExNS4xN2gtNDAuNTJsLTM2LjktMTMwLjk2LDUyLjEsMTcuNzd2MjYuMzJjLTIwLjI2LTE0LjQ4LTM5LjItMjQuNzgtNTYuOC0zMC45My0xNy42MS02LjE0LTM3Ljc1LTkuMjEtNjAuNDItOS4yMS0zNS43LDAtNjcuNzgsOC41Ni05Ni4yMywyNS42Ny0yOC40NywxNy4xMS01MS4wMSw0Mi44OS02Ny42NSw3Ny4zMy0xNi42NCwzNC40NS0yNC45Niw3Ny4zMy0yNC45NiwxMjguNjYsMCw0Ny44Myw3Ljk2LDg5LjA3LDIzLjg4LDEyMy43MiwxNS45MiwzNC42NiwzNy43NCw2MS4zMiw2NS40OCw3OS45NiwyNy43MywxOC42NSw1OC45NywyNy45Nyw5My43LDI3Ljk3LDE4LjMzLDAsMzUuNTctMS43NSw1MS43My01LjI3LDE2LjE2LTMuNTEsMzIuNDQtOC4zMyw0OC44NC0xNC40OGwtMzUuNDUsMTkuNzR2LTUzLjk2YzAtMjkuMzktLjI1LTU4LjAyLS43Mi04NS44OC0uNDktMjcuODYtMS4yMS01Ni40OC0yLjE3LTg1Ljg4aDEwMi43NGMtLjQ5LDI3LjY0LTEuMDksNTUuNTEtMS44MSw4My41OC0uNzIsMjguMDgtMS4wOSw1OC4xNC0xLjA5LDkwLjE2djMyLjkxYy0yNy45OCwxNC45Mi01NS40OCwyNS44OS04Mi40OSwzMi45LTI3LjAyLDcuMDEtNTcuMTYsMTAuNTMtOTAuNDQsMTAuNTNaTTEwOTQuNTcsMzIzLjY0di0yMS43MmgyMjguNjR2MjEuNzJsLTg2LjgzLDkuODdoLTQwLjUybC0xMDEuMy05Ljg3WiIvPgogICAgICA8cGF0aCBjbGFzcz0iY2xzLTciIGQ9Ik0xMzYwLjEyLDczLjU2di0yMS43MmgyNDIuMzl2MjEuNzJsLTExMS40Myw5LjIxaC0yMC4yNmwtMTEwLjctOS4yMVpNMTM2MC4xMiw1MzkuNXYtMjEuNzJsMTEwLjctOS4yMWgyMC4yNmwxMTEuNDMsOS4yMXYyMS43MmgtMjQyLjM5Wk0xNDI4LjEzLDUzOS41Yy45Ni0zNy4yOSwxLjU2LTc0LjkxLDEuODEtMTEyLjg2LjI0LTM3Ljk0LjM2LTc2LjIzLjM2LTExNC44NHYtMzEuNTljMC0zOC4xNy0uMTItNzYuMjMtLjM2LTExNC4xOC0uMjUtMzcuOTQtLjg1LTc2LjAxLTEuODEtMTE0LjE4aDEwNy4wOWMtLjk3LDM3LjMtMS41Nyw3NS4xNC0xLjgxLDExMy41Mi0uMjUsMzguNC0uMzYsNzYuNjctLjM2LDExNC44NHYzMC45M2MwLDM4LjE3LjExLDc2LjI0LjM2LDExNC4xOC4yNCwzNy45NS44NCw3Ni4wMSwxLjgxLDExNC4xOGgtMTA3LjA5WiIvPgogICAgICA8cGF0aCBjbGFzcz0iY2xzLTciIGQ9Ik0xODM2LjIxLDU1MmMtMjkuNDMsMC01OC44Ni0zLjUyLTg4LjI3LTEwLjUzLTI5LjQzLTcuMDEtNTQuMjctMTYuNjctNzQuNTMtMjguOTZsNC4zNC0xMDcuOTNoMzguMzVsMzYuMTgsMTI0LjM4LTQ0LjE0LTE3LjExLTcuOTYtMjUuMDFjMjMuNjMsMTUuMzYsNDQuNjEsMjUuNTYsNjIuOTUsMzAuNiwxOC4zMyw1LjA1LDM5LjU1LDcuNTcsNjMuNjcsNy41NywzNi42NSwwLDY1LjM2LTcuNTcsODYuMS0yMi43MSwyMC43My0xNS4xNCwzMS4xMS0zNi41MiwzMS4xMS02NC4xNiwwLTE1LjM1LTIuNjYtMjguNTEtNy45Ni0zOS40OS01LjMxLTEwLjk2LTE0LjM2LTIwLjgzLTI3LjEzLTI5LjYxLTEyLjc5LTguNzctMzAuMDMtMTcuMzMtNTEuNzMtMjUuNjdsLTMzLjI4LTEzLjE2Yy00Ni4zMS0xOC44Ni04MS42NS00MC4xNC0xMDYtNjMuODQtMjQuMzYtMjMuNjktMzYuNTQtNTQuNC0zNi41NC05Mi4xMywwLTI4Ljk2LDguMDctNTMuNDEsMjQuMjQtNzMuMzgsMTYuMTUtMTkuOTYsMzguMzUtMzUuMSw2Ni41Ny00NS40MSwyOC4yMi0xMC4zLDYwLjQyLTE1LjQ2LDk2LjYtMTUuNDYsMjguNDYsMCw1NC41LDMuMTksNzguMTQsOS41NCwyMy42Myw2LjM3LDQ0Ljg2LDE1LjQ3LDYzLjY3LDI3LjMxbC01LjA2LDEwMi42NmgtMzguMzVsLTM1LjQ1LTExOC40Niw0Ny43NSwxOC40Myw1Ljc5LDI2LjMyYy0yMC4yNi0xNC45MS0zNy43NS0yNS4yMi01Mi40Ni0zMC45My0xNC43Mi01LjctMzIuMi04LjU2LTUyLjQ2LTguNTYtMzIuMzIsMC01OC42MSw3LjAyLTc4Ljg3LDIxLjA2LTIwLjI2LDE0LjA1LTMwLjM5LDM0LjAxLTMwLjM5LDU5Ljg5LDAsMjMuNjksNy4yNCw0Mi41NiwyMS43MSw1Ni42LDE0LjQ3LDE0LjA1LDM0Ljk3LDI2LjMyLDYxLjUsMzYuODVsMzYuMTgsMTQuNDhjMzYuMTgsMTQuNDgsNjUsMjguOTYsODYuNDcsNDMuNDMsMjEuNDYsMTQuNDgsMzYuOSwzMC41LDQ2LjMxLDQ4LjA0LDkuNDEsMTcuNTUsMTQuMTEsMzguNCwxNC4xMSw2Mi41MiwwLDI4LjUyLTcuOTYsNTMuNDItMjMuODgsNzQuNjktMTUuOTIsMjEuMjktMzguODMsMzcuOTUtNjguNzQsNTAuMDItMjkuOTEsMTIuMDYtNjYuMDksMTguMS0xMDguNTMsMTguMVoiLz4KICAgICAgPHBhdGggZD0iTTU5MC45OSwzNzYuMjl2LTQzLjQzaDE4NC45M3Y0My40M2gtMTg0LjkzWiIvPgogICAgICA8cGF0aCBkPSJNMTEwMC4zNiw1NTJjLTU1Ljk2LDAtMTA0LjkyLTEwLjUzLTE0Ni44OC0zMS41OS00MS45Ny0yMS4wNi03NC42NS01MC43OC05OC4wNC04OS4xNy0yMy40LTM4LjM5LTM1LjA5LTgzLjkxLTM1LjA5LTEzNi41NnMxMS45NC05Ny4yOCwzNS44Mi0xMzUuMjRjMjMuODgtMzcuOTQsNTcuMTYtNjcuMzQsOTkuODUtODguMTgsNDIuNjktMjAuODMsOTIuMDEtMzEuMjYsMTQ3Ljk3LTMxLjI2LDMxLjg0LDAsNjAuNDIsMy4wNyw4NS43NCw5LjIxLDI1LjMyLDYuMTUsNDkuMDgsMTUuMTQsNzEuMjcsMjYuOThsLTEuNDUsMTE1LjE3aC00MC41MmwtMzYuOS0xMzAuOTYsNTIuMSwxNy43N3YyNi4zMmMtMjAuMjYtMTQuNDgtMzkuMi0yNC43OC01Ni44LTMwLjkzLTE3LjYxLTYuMTQtMzcuNzUtOS4yMS02MC40Mi05LjIxLTM1LjcsMC02Ny43OCw4LjU2LTk2LjIzLDI1LjY3LTI4LjQ3LDE3LjExLTUxLjAxLDQyLjg5LTY3LjY1LDc3LjMzLTE2LjY0LDM0LjQ1LTI0Ljk2LDc3LjMzLTI0Ljk2LDEyOC42NiwwLDQ3LjgzLDcuOTYsODkuMDcsMjMuODgsMTIzLjcyLDE1LjkyLDM0LjY2LDM3Ljc0LDYxLjMyLDY1LjQ4LDc5Ljk2LDI3LjczLDE4LjY1LDU4Ljk3LDI3Ljk3LDkzLjcsMjcuOTcsMTguMzMsMCwzNS41Ny0xLjc1LDUxLjczLTUuMjcsMTYuMTYtMy41MSwzMi40NC04LjMzLDQ4Ljg0LTE0LjQ4bC0zNS40NSwxOS43NHYtNTMuOTZjMC0yOS4zOS0uMjUtNTguMDItLjcyLTg1Ljg4LS40OS0yNy44Ni0xLjIxLTU2LjQ4LTIuMTctODUuODhoMTAyLjc0Yy0uNDksMjcuNjQtMS4wOSw1NS41MS0xLjgxLDgzLjU4LS43MiwyOC4wOC0xLjA5LDU4LjE0LTEuMDksOTAuMTZ2MzIuOTFjLTI3Ljk4LDE0LjkyLTU1LjQ4LDI1Ljg5LTgyLjQ5LDMyLjktMjcuMDIsNy4wMS01Ny4xNiwxMC41My05MC40NCwxMC41M1pNMTA5NC41NywzMjMuNjR2LTIxLjcyaDIyOC42NHYyMS43Mmwtg7YuODMsOS44N2gtNDAuNTJsLTEwMS4zLTkuODdaIi8+CiAgICAgIDxwYXRoIGQ9Ik0xMzYwLjEyLDczLjU2di0yMS43MmgyNDIuMzl2MjEuNzJsLTExMS40Myw5LjIxaC0yMC4yNmwtMTEwLjctOS4yMVpNMTM2MC4xMiw1MzkuNXYtMjEuNzJsMTEwLjctOS4yMWgyMC4yNmwxMTEuNDMsOS4yMXYyMS43MmgtMjQyLjM5Wk0xNDI4LjEzLDUzOS41Yy45Ni0zNy4yOSwxLjU2LTc0LjkxLDEuODEtMTEyLjg2LjI0LTM3Ljk0LjM2LTc2LjIzLjM2LTExNC44NHYtMzEuNTljMC0zOC4xNy0uMTItNzYuMjMtLjM2LTExNC4xOC0uMjUtMzcuOTQtLjg1LTc2LjAxLTEuODEtMTE0LjE4aDEwNy4wOWMtLjk3LDM3LjMtMS41Nyw3NS4xNC0xLjgxLDExMy41Mi0uMjUsMzguNC0uMzYsNzYuNjctLjM2LDExNC44NHYzMC45M2MwLDM4LjE3LjExLDc2LjI0LjM2LDExNC4xOC4yNCwzNy45NS44NCw3Ni4wMSwxLjgxLDExNC4xOGgtMTA3LjA5WiIvPgogICAgICA8cGF0aCBkPSJNMTgzNi4yMSw1NTJjLTI5LjQzLDAtNTguODYtMy41Mi04OC4yNy0xMC41My0yOS40My03LjAxLTU0LjI3LTE2LjY3LTc0LjUzLTI4Ljk2bDQuMzQtMTA3LjkzaDM4LjM1bDM2LjE4LDEyNC4zOC00NC4xNC0xNy4xMS03Ljk2LTI1LjAxYzIzLjYzLDE1LjM2LDQ0LjYxLDI1LjU2LDYyLjk1LDMwLjYsMTguMzMsNS4wNSwzOS41NSw3LjU3LDYzLjY3LDcuNTcsMzYuNjUsMCw2NS4zNi03LjU3LDg2LjEtMjIuNzEsMjAuNzMtMTUuMTQsMzEuMTEtMzYuNTIsMzEuMTEtNjQuMTYsMC0xNS4zNS0yLjY2LTI4LjUxLTcuOTYtMzkuNDktNS4zMS0xMC45Ni0xNC4zNi0yMC44My0yNy4xMy0yOS42MS0xMi43OS04Ljc3LTMwLjAzLTE3LjMzLTUxLjczLTI1LjY3bC0zMy4yOC0xMy4xNmMtNDYuMzEtMTguODYtODEuNjUtNDAuMTQtMTA2LTYzLjg0LTI0LjM2LTIzLjY5LTM2LjU0LTU0LjQtMzYuNTQtOTIuMTMsMC0yOC45Niw4LjA3LTUzLjQxLDI0LjI0LTczLjM4LDE2LjE1LTE5Ljk2LDM4LjM1LTM1LjEsNjYuNTctNDUuNDEsMjguMjItMTAuMyw2MC40Mi0xNS40Niw5Ni42LTE1LjQ2LDI4LjQ2LDAsNTQuNSwzLjE5LDc4LjE0LDkuNTQsMjMuNjMsNi4zNyw0NC44NiwxNS40Nyw2My42NywyNy4zMWwtNS4wNiwxMDIuNjZoLTM4LjM1bC0zNS40NS0xMTguNDYsNDcuNzUsMTguNDMsNS43OSwyNi4zMmMtMjAuMjYtMTQuOTEtMzcuNzUtMjUuMjItNTIuNDYtMzAuOTMtMTQuNzItNS43LTMyLjItOC41Ni01Mi40Ni04LjU2LTMyLjMyLDAtNTguNjEsNy4wMi03OC44NywyMS4wNi0yMC4yNiwxNC4wNS0zMC4zOSwzNC4wMS0zMC4zOSw1OS44OSwwLDIzLjY5LDcuMjQsNDIuNTYsMjEuNzEsNTYuNiwxNC40NywxNC4wNSwzNC45NywyNi4zMiw2MS41LDM2Ljg1bDM2LjE4LDE0LjQ4YzM2LjE4LDE0LjQ4LDY1LDI4Ljk2LDg2LjQ3LDQzLjQzLDIxLjQ2LDE0LjQ4LDM2LjksMzAuNSw0Ni4zMSw0OC4wNCw5LjQxLDE3LjU1LDE0LjExLDM4LjQsMTQuMTEsNjIuNTIsMCwyOC41Mi03Ljk2LDUzLjQyLTIzLjg4LDc0LjY5LTE1LjkyLDIxLjI5LTM4LjgzLDM3Ljk1LTY4Ljc0LDUwLjAyLTI5LjkxLDEyLjA2LTY2LjA5LDE4LjEtMTA4LjUzLDE4LjFaIi8+CiAgICA8L2c+CiAgPC9nPgo8L3N2Zz4=`;

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
            <span class="logo-text">e-GIS</span>
          </div>
        </div>
        <div class="menu-center">
          <div class="menu-items">
            <div class="menu-item dropdown" data-menu="project">
              <button class="menu-button">프로젝트</button>
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
              <button class="menu-button">편집</button>
              <div class="dropdown-menu" id="menu-edit">
                <div class="dropdown-item" data-action="edit-delete">선택 피처 삭제</div>
                <div class="dropdown-item" data-action="edit-select-all">모두 선택</div>
                <div class="dropdown-item" data-action="edit-deselect">선택 해제</div>
              </div>
            </div>
            <div class="menu-item dropdown" data-menu="view">
              <button class="menu-button">보기</button>
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
              <button class="menu-button">레이어</button>
              <div class="dropdown-menu" id="menu-layer">
                <div class="dropdown-item" data-action="layer-from-coords">좌표 데이터 가져오기</div>
                <div class="dropdown-item" data-action="layer-remove">레이어 삭제</div>
                <div class="dropdown-item" data-action="layer-rename">이름 변경</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" data-action="layer-attribute-table">속성 테이블</div>
                <div class="dropdown-item" data-action="layer-table-join">테이블 조인</div>
                <div class="dropdown-item" data-action="layer-label">라벨 설정</div>
                <div class="dropdown-item" data-action="layer-field-calculator">필드 계산기</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" data-action="layer-export">레이어 내보내기</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" data-action="layer-clear-all">모든 레이어 삭제</div>
              </div>
            </div>
            <div class="menu-item dropdown" data-menu="measure">
              <button class="menu-button">측정</button>
              <div class="dropdown-menu" id="menu-measure">
                <div class="dropdown-item" data-action="analysis-measure-distance">거리 측정</div>
                <div class="dropdown-item" data-action="analysis-measure-area">면적 측정</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" data-action="analysis-clear-measures">측정 결과 지우기</div>
              </div>
            </div>
            <div class="menu-item dropdown" data-menu="vector-analysis">
              <button class="menu-button">벡터 분석</button>
              <div class="dropdown-menu" id="menu-vector-analysis">
                <div class="dropdown-item" data-action="analysis-choropleth">단계구분도</div>
                <div class="dropdown-item" data-action="analysis-chart-map">도형표현도</div>
                <div class="dropdown-item" data-action="analysis-heatmap">히트맵</div>
                <div class="dropdown-item" data-action="analysis-cartogram">카토그램</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" data-action="analysis-buffer">버퍼 분석</div>
                <div class="dropdown-item" data-action="analysis-spatial-ops">공간 연산</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" data-action="analysis-isochrone">등시선 분석</div>
                <div class="dropdown-item" data-action="analysis-routing">최단경로 분석</div>
              </div>
            </div>
            <div class="menu-item disabled" data-menu="raster-analysis">
              <button class="menu-button" data-action="raster-coming-soon">래스터 분석</button>
            </div>
            <button class="btn-help" id="btn-help" title="사용 설명서">❓</button>
          </div>
        </div>
        <div class="menu-right">
          <div class="header-auth" id="header-auth">
            <button class="btn btn-sm btn-primary" id="header-login-btn">로그인</button>
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
          <button class="btn-icon" data-tool="select" title="선택">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
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
        </div>

        <div class="toolbar-spacer"></div>

        <!-- 카피라이트 -->
        <span class="toolbar-copyright">ⓒ 2025 충남삼성고등학교 김용현T | cnsageo@cnsa.hs.kr</span>

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
            <div class="panel-header"><span class="panel-header-title">레이어 목록</span><div class="panel-header-actions"><button class="btn-icon btn-small" id="btn-add-layer" title="새 레이어 추가"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></button></div></div>
            <div class="panel-content"><ul id="layer-list" class="layer-list"></ul></div>
          </div>
          <div id="tab-browser" class="tab-content">
            <div class="panel-header"><span class="panel-header-title">파일 업로드</span></div>
            <div class="panel-content">
              <div class="file-drop-zone" id="file-drop-zone">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:8px;opacity:0.6;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                <p>파일을 드래그하거나<br>클릭하여 업로드</p>
                <p class="file-types">GeoJSON, Shapefile(ZIP), GPKG, DEM(TIF/IMG)</p>
              </div>
            </div>
          </div>
        </aside>

        <!-- 패널 리사이저 -->
        <div class="panel-resizer" id="panel-resizer"></div>

        <!-- 지도 컨테이너 -->
        <main id="map-container">
          <div id="map"></div>
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
        <div class="statusbar-item">
          <span id="status-message">준비</span>
        </div>
      </footer>
    `;

    this.addStyles();
    this.initResizer();
    this.initTabs();
    this.setFavicon();
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

      .app-logo .logo-image {
        height: 26px;
        width: auto;
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
}
