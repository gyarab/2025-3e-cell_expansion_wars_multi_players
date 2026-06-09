from django.urls import path, re_path
from . import views

urlpatterns = [
    path('', views.homepage),
    path('game.html', views.game_page),
    re_path(r'^login/?$', views.login_view),
    re_path(r'^register/?$', views.register_view),
    re_path(r'^username_exists/(?P<username>.+?)/?$', views.username_exists),
    re_path(r'^user(?P<uid>[0-9]+?)/?$', views.user_profile),
    re_path(r'^user(?P<uid>[0-9]+?)/change_info/?$', views.change_user_info),
    re_path(r'^user(?P<uid>[0-9]+?)/logout/?$', views.logout_view),
    re_path(r'^user(?P<uid>[0-9]+?)/level(?P<level_id>[0-9]+?)/game(?P<game_id>[0-9]+?)/?$', views.game),
    re_path(r'^user(?P<uid>[0-9]+?)/preset(?P<preset_id>[0-9]+?)/?$', views.multi_player_game_config),
    re_path(r'^user(?P<uid>[0-9]+?)/preset(?P<preset_id>[0-9]+?)/game(?P<game_id>[0-9]+?)/?$', views.multi_player_game),
]
