"""
URL configuration for prj project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, re_path
from main import views


urlpatterns = [
    path("admin/", admin.site.urls),
    path("", views.homepage),
    re_path(r"^login/??$", views.login),
    re_path(r"^register/??$", views.register),
    re_path(r"^logout/??$", views.logout),
    re_path(r"^user(?P<uid>[0-9]+?/??$", views.user_profile),
    re_path(r"^user(?P<uid>[0-9]+?/logout/??$", views.user_logout),
    re_path(r"^user(?P<uid>[0-9]+?)/level/??$", views.level_select),
    re_path(r"^user(?P<uid>[0-9]+?)/level(?P<level_id>[0-9]+?)/??$", views.game_config),
    re_path(r"^user(?P<uid>[0-9]+?)/level(?P<level_id>[0-9]+?)/game(?P<game_id>[0-9]+?)/??$", views.game),
    #re_path(r"^ws/user(?P<uid>[0-9]+?)/level(?P<level_id>[0-9]+?)/game(?P<game_id>[0-9]+?)/??$", views.game_socket),
    re_path(r"^user(?P<uid>[0-9]+?)/preset/??$", views.preset_select),
    re_path(r"^user(?P<uid>[0-9]+?)/preset(?P<preset_id>[0-9]+?)/??$", views.multi_player_game_config),
    re_path(r"^user(?P<uid>[0-9]+?)/preset(?P<preset_id>[0-9]+?)/game(?P<game_id>[0-9]+?)/??$", views.multi_player_game)
    #re_path(r"^ws/user(?P<uid>[0-9]+?)/preset(?P<preset_id>[0-9]+?)/game(?P<game_id>[0-9]+?)/??$", views.multi_player_game_socket)
]
